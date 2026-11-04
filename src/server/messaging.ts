import { randomUUID } from "node:crypto";
import { db, isUniqueViolation, type Tx } from "./db";
import { AppError, forbidden } from "./errors";
import { can, passesContactFilter, type ContactFilter } from "@/domain/access";
import { pairKey, validateMessageBody } from "@/domain/messaging";
import { ageFromBirthYear } from "@/domain/geo";
import { areConnected, isBlockedEitherWay, personState, profileState } from "./state";
import { postLedger } from "./tokens";
import { enqueue } from "./outbox";

export interface SendInput {
  actorUserId: string;
  fromProfileId: string;
  toProfileId: string;
  body: string;
  clientKey: string; // Idempotenzschlüssel vom Client
  kind?: "text" | "gift";
  giftKey?: string;
}

export interface SendResult {
  messageId: string;
  conversationId: string;
  tokenCost: number;
  balance: number;
  duplicate: boolean;
  isRequest: boolean;
}

/**
 * Sendet eine Direktnachricht. Rechte, Filter, Kontaktanfrage-Regel, Tokenverbrauch,
 * Nachricht und Zustell-Outbox werden ATOMAR in einer Transaktion geschrieben.
 * Abgewiesene Nachrichten kosten nichts (Prüfung vor Buchung, Rollback bei Fehler).
 */
export async function sendMessage(input: SendInput): Promise<SendResult> {
  const kind = input.kind ?? "text";
  const v = validateMessageBody(input.body, kind);
  if (v) throw new AppError("invalid_body", v.message);
  if (!input.clientKey || input.clientKey.length > 100) throw new AppError("invalid_key", "Ungültiger Idempotenzschlüssel.");
  if (input.fromProfileId === input.toProfileId) throw new AppError("self", "Du kannst dir nicht selbst schreiben.");

  // Idempotenz: bereits gespeichert → gleiches Ergebnis, kein zweiter Verbrauch
  const prior = await db.message.findUnique({
    where: { senderProfileId_clientKey: { senderProfileId: input.fromProfileId, clientKey: input.clientKey } },
  });
  if (prior) return duplicateResult(prior.id, prior.conversationId, input.fromProfileId);

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => doSend(tx, input, kind), { timeout: 15000 });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const m = await db.message.findUnique({
        where: { senderProfileId_clientKey: { senderProfileId: input.fromProfileId, clientKey: input.clientKey } },
      });
      if (m) return duplicateResult(m.id, m.conversationId, input.fromProfileId);
      // z. B. parallele Konversationserstellung → einmal neu versuchen
      if (attempt >= 2) throw e;
    }
  }
}

async function duplicateResult(messageId: string, conversationId: string, profileId: string): Promise<SendResult> {
  const p = await db.communityProfile.findUniqueOrThrow({ where: { id: profileId } });
  const m = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  return { messageId, conversationId, tokenCost: m.tokenCost, balance: p.tokenBalance, duplicate: true, isRequest: false };
}

async function doSend(tx: Tx, input: SendInput, kind: "text" | "gift"): Promise<SendResult> {
  const actor = await personState(input.actorUserId, tx);
  const from = await profileState(input.fromProfileId, tx);
  const to = await tx.communityProfile.findUnique({
    where: { id: input.toProfileId },
    include: { memberships: { where: { status: "active" } } },
  });
  if (!actor || !from || !to || to.status !== "active") throw new AppError("not_found", "Profil nicht verfügbar.", 404);
  const capability = can("send_message", actor, from);
  if (!capability.allowed) throw forbidden(capability.reason);
  if (await isBlockedEitherWay(input.fromProfileId, input.toProfileId, tx)) throw forbidden("Kontakt nicht möglich.");

  const fromRow = await tx.communityProfile.findUniqueOrThrow({ where: { id: input.fromProfileId } });
  const filter = (to.contactFilter ?? {}) as ContactFilter;
  const ages = [fromRow.birthYearA, fromRow.birthYearB].filter((x): x is number => !!x).map((y) => ageFromBirthYear(y));
  if (!passesContactFilter(filter, { type: from.type, verified: fromRow.verifiedBadge, ages })) {
    throw forbidden("Dieses Profil nimmt derzeit keine Nachrichten von dir an.");
  }

  // Konversation (eindeutig je Profilpaar). Anlegen ohne Konflikt, dann Zeilensperre →
  // alle Sendevorgänge innerhalb derselben Konversation werden serialisiert.
  const key = pairKey(input.fromProfileId, input.toProfileId);
  await tx.$executeRaw`INSERT INTO "Conversation" (id, "pairKey", "createdAt") VALUES (${randomUUID()}, ${key}, now()) ON CONFLICT ("pairKey") DO NOTHING`;
  const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Conversation" WHERE "pairKey" = ${key} FOR UPDATE`;
  await tx.conversationParticipant.createMany({
    data: [{ conversationId: locked.id, profileId: input.fromProfileId }, { conversationId: locked.id, profileId: input.toProfileId }],
    skipDuplicates: true,
  });
  const conv = await tx.conversation.findUniqueOrThrow({ where: { id: locked.id }, include: { request: true } });
  const connected = await areConnected(input.fromProfileId, input.toProfileId, tx);
  let isRequest = false;

  if (!connected) {
    const anyMessage = await tx.message.count({ where: { conversationId: conv.id } });
    if (!conv.request && anyMessage === 0) {
      // Genau eine zulässige Nachrichtenanfrage an Fremde
      await tx.messageRequest.create({ data: { conversationId: conv.id, fromProfileId: input.fromProfileId, toProfileId: input.toProfileId } });
      isRequest = true;
    } else if (conv.request?.status === "accepted") {
      // angenommen → frei schreiben
    } else if (conv.request && conv.request.status === "pending" && conv.request.toProfileId === input.fromProfileId) {
      // Empfänger antwortet → gilt als Annahme
      await tx.messageRequest.update({ where: { id: conv.request.id }, data: { status: "accepted", respondedAt: new Date() } });
    } else {
      throw forbidden("Weitere Nachrichten sind erst nach Annahme deiner Anfrage möglich.");
    }
  }

  // Geschenke: serverseitig konfigurierte Kosten
  let giftCost = 0;
  let giftId: string | undefined;
  if (kind === "gift") {
    const gift = await tx.giftType.findFirst({ where: { key: input.giftKey ?? "", active: true } });
    if (!gift) throw new AppError("gift_invalid", "Geschenk nicht verfügbar.");
    giftCost = gift.tokenCost;
    giftId = gift.id;
  }
  const messageCost = capability.tokenCostPerMessage ?? 1;
  const cost = messageCost + giftCost;

  const membership = await tx.profileMembership.findFirst({ where: { profileId: input.fromProfileId, userId: input.actorUserId } });
  const msg = await tx.message.create({
    data: {
      conversationId: conv.id, senderProfileId: input.fromProfileId, senderUserId: input.actorUserId,
      senderLabel: membership?.displayLabel ?? null, kind, body: input.body, giftId,
      clientKey: input.clientKey, tokenCost: cost,
    },
  });
  let balance = fromRow.tokenBalance;
  if (cost > 0) {
    const r = await postLedger(tx, {
      profileId: input.fromProfileId, delta: -cost, kind: kind === "gift" ? "gift" : "message",
      idemKey: `msg:${msg.id}`, refType: "message", refId: msg.id, actorUserId: input.actorUserId,
    });
    balance = r.entry.balanceAfter;
  }
  await enqueue(tx, "message.created", { messageId: msg.id, conversationId: conv.id, toProfileId: input.toProfileId });
  return { messageId: msg.id, conversationId: conv.id, tokenCost: cost, balance, duplicate: false, isRequest };
}

/** Technischer Fehlschlag nach Speicherung (z. B. Nachricht nachweislich nicht zustellbar) → nachvollziehbare Rückbuchung. */
export async function refundTechnicalFailure(messageId: string, actorUserId: string | null, reason: string) {
  return db.$transaction(async (tx) => {
    const m = await tx.message.findUniqueOrThrow({ where: { id: messageId } });
    if (m.tokenCost <= 0) return null;
    return postLedger(tx, {
      profileId: m.senderProfileId, delta: m.tokenCost, kind: "refund_technical", idemKey: `refund:msg:${m.id}`,
      refType: "message", refId: m.id, actorUserId: actorUserId ?? undefined, reason,
    });
  });
}

export async function respondToRequest(actorUserId: string, profileId: string, conversationId: string, accept: boolean) {
  const member = await db.profileMembership.findFirst({ where: { profileId, userId: actorUserId, status: "active" } });
  if (!member) throw forbidden();
  const req = await db.messageRequest.findUnique({ where: { conversationId } });
  if (!req || req.toProfileId !== profileId || req.status !== "pending") throw new AppError("not_pending", "Keine offene Anfrage.");
  await db.messageRequest.update({ where: { id: req.id }, data: { status: accept ? "accepted" : "declined", respondedAt: new Date() } });
}

/** Lesen: nur Teilnehmer; Empfang/Lesen ist immer kostenlos. */
export async function readConversation(actorUserId: string, profileId: string, conversationId: string) {
  const member = await db.profileMembership.findFirst({ where: { profileId, userId: actorUserId, status: "active" } });
  if (!member) throw forbidden();
  const part = await db.conversationParticipant.findUnique({ where: { conversationId_profileId: { conversationId, profileId } } });
  if (!part) throw forbidden();
  await db.conversationParticipant.update({ where: { conversationId_profileId: { conversationId, profileId } }, data: { lastReadAt: new Date() } });
  return db.message.findMany({ where: { conversationId, deletedAt: null }, orderBy: { createdAt: "asc" }, take: 500 });
}
