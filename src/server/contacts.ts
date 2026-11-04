import { db, type Tx } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { can, passesContactFilter, type ContactFilter } from "@/domain/access";
import { ageFromBirthYear } from "@/domain/geo";
import { orderedPair } from "@/domain/messaging";
import { areConnected, isBlockedEitherWay, personState, profileState } from "./state";
import { getSetting } from "./settings";
import { enqueue } from "./outbox";

/**
 * Kontakte: Kontaktanfragen (gegenseitige Freigabe), Favoriten, Likes aus der Bildentdeckung.
 * Jede Mutation prüft die aktive Mitgliedschaft der handelnden Person im handelnden Profil.
 * Blockierung und Kontaktfilter haben Vorrang vor Tarif, Kauf und Tageslimit.
 */

export async function assertMember(userId: string, profileId: string, tx: Tx = db) {
  const m = await tx.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!m) throw forbidden("Kein Mitglied dieses Profils.");
  return m;
}

export function agesOf(p: { birthYearA: number | null; birthYearB: number | null }, now = new Date()): number[] {
  return [p.birthYearA, p.birthYearB].filter((x): x is number => !!x).map((y) => ageFromBirthYear(y, now));
}

async function notifyProfile(tx: Tx, profileId: string, kind: string, title: string, link: string) {
  const ms = await tx.profileMembership.findMany({ where: { profileId, status: "active" } });
  for (const m of ms) await enqueue(tx, "notify.user", { userId: m.userId, kind, title, link });
}

export async function sendContactRequest(userId: string, fromProfileId: string, toProfileId: string) {
  await assertMember(userId, fromProfileId);
  if (fromProfileId === toProfileId) throw new AppError("self", "Das ist dein eigenes Profil.");
  const actor = await personState(userId);
  const from = await profileState(fromProfileId);
  if (!actor || !from) throw forbidden();
  const c = can("contact_request", actor, from);
  if (!c.allowed) throw forbidden(c.reason);

  const to = await db.communityProfile.findUnique({ where: { id: toProfileId } });
  if (!to || to.status !== "active") throw notFound("Profil nicht verfügbar.");
  // Vorrang 1: Blockierung (in beide Richtungen)
  if (await isBlockedEitherWay(fromProfileId, toProfileId)) throw forbidden("Kontakt nicht möglich.");
  // Vorrang 2: Kontaktfilter des Gegenübers
  const fromRow = await db.communityProfile.findUniqueOrThrow({ where: { id: fromProfileId } });
  if (!passesContactFilter((to.contactFilter ?? {}) as ContactFilter, { type: from.type, verified: fromRow.verifiedBadge, ages: agesOf(fromRow) })) {
    throw forbidden("Dieses Profil nimmt derzeit keine Kontaktanfragen von dir an.");
  }
  if (await areConnected(fromProfileId, toProfileId)) throw new AppError("already", "Ihr seid bereits verbunden.");

  const pending = await db.contactRequest.findFirst({
    where: { status: "pending", OR: [{ fromId: fromProfileId, toId: toProfileId }, { fromId: toProfileId, toId: fromProfileId }] },
  });
  if (pending && pending.fromId === fromProfileId) throw new AppError("duplicate", "Deine Anfrage ist bereits unterwegs.");
  if (pending && pending.fromId === toProfileId) {
    // Gegenseitiges Interesse: offene Gegenanfrage wird angenommen
    await respondContactRequest(userId, fromProfileId, pending.id, true);
    return { status: "connected" as const };
  }

  // Vorrang 3: Tageslimit
  const limits = await getSetting("ratelimits");
  const since = new Date(Date.now() - 86400_000);
  const sent = await db.contactRequest.count({ where: { fromId: fromProfileId, createdAt: { gte: since } } });
  if (sent >= limits.contactRequestsPerDay) {
    throw new AppError("rate_limited", `Du hast heute bereits ${limits.contactRequestsPerDay} Kontaktanfragen gesendet. Morgen geht es weiter.`, 429);
  }

  const req = await db.$transaction(async (tx) => {
    const r = await tx.contactRequest.create({ data: { fromId: fromProfileId, toId: toProfileId } });
    await notifyProfile(tx, toProfileId, "contact_request", "Neue Kontaktanfrage", "/app/nachrichten?ordner=kontakte");
    return r;
  });
  return { status: "sent" as const, requestId: req.id };
}

export async function respondContactRequest(userId: string, profileId: string, requestId: string, accept: boolean) {
  await assertMember(userId, profileId);
  const req = await db.contactRequest.findUnique({ where: { id: requestId } });
  if (!req || req.toId !== profileId || req.status !== "pending") throw new AppError("not_pending", "Keine offene Anfrage.");
  if (accept && (await isBlockedEitherWay(req.fromId, req.toId))) throw forbidden("Kontakt nicht möglich.");
  await db.$transaction(async (tx) => {
    await tx.contactRequest.update({ where: { id: req.id }, data: { status: accept ? "accepted" : "declined", respondedAt: new Date() } });
    if (accept) {
      const [a, b] = orderedPair(req.fromId, req.toId);
      await tx.connection.upsert({ where: { aId_bId: { aId: a, bId: b } }, create: { aId: a, bId: b }, update: { endedAt: null } });
      await notifyProfile(tx, req.fromId, "contact_accepted", "Eine Kontaktanfrage wurde angenommen", "/app/nachrichten?ordner=kontakte");
    }
  });
}

export async function withdrawContactRequest(userId: string, profileId: string, requestId: string) {
  await assertMember(userId, profileId);
  const r = await db.contactRequest.updateMany({ where: { id: requestId, fromId: profileId, status: "pending" }, data: { status: "withdrawn" } });
  if (r.count === 0) throw new AppError("not_pending", "Keine offene Anfrage.");
}

/** Verbindung beenden (ohne Blockierung). */
export async function endConnection(userId: string, profileId: string, otherProfileId: string) {
  await assertMember(userId, profileId);
  const [a, b] = orderedPair(profileId, otherProfileId);
  await db.connection.updateMany({ where: { aId: a, bId: b, endedAt: null }, data: { endedAt: new Date() } });
}

export async function listContactRequests(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  const sel = { select: { id: true, handle: true, type: true, verifiedBadge: true, status: true } };
  const [incoming, outgoing] = await Promise.all([
    db.contactRequest.findMany({ where: { toId: profileId, status: "pending", from: { status: "active" } }, include: { from: sel }, orderBy: { createdAt: "desc" } }),
    db.contactRequest.findMany({ where: { fromId: profileId, status: "pending" }, include: { to: sel }, orderBy: { createdAt: "desc" } }),
  ]);
  return { incoming, outgoing };
}

export async function listConnections(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  const rows = await db.connection.findMany({
    where: { endedAt: null, OR: [{ aId: profileId }, { bId: profileId }] },
    include: {
      a: { select: { id: true, handle: true, type: true, verifiedBadge: true, status: true } },
      b: { select: { id: true, handle: true, type: true, verifiedBadge: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, since: r.createdAt, other: r.aId === profileId ? r.b : r.a })).filter((r) => r.other.status === "active");
}

export async function toggleFavorite(userId: string, profileId: string, targetId: string): Promise<boolean> {
  await assertMember(userId, profileId);
  if (profileId === targetId) throw new AppError("self", "Das ist dein eigenes Profil.");
  const existing = await db.favorite.findUnique({ where: { ownerId_targetId: { ownerId: profileId, targetId } } });
  if (existing) {
    await db.favorite.delete({ where: { ownerId_targetId: { ownerId: profileId, targetId } } });
    return false;
  }
  const t = await db.communityProfile.findUnique({ where: { id: targetId } });
  if (!t || t.status !== "active") throw notFound("Profil nicht verfügbar.");
  if (await isBlockedEitherWay(profileId, targetId)) throw forbidden("Nicht möglich.");
  await db.favorite.create({ data: { ownerId: profileId, targetId } });
  return true;
}

/**
 * Bildentdeckung: Like/Pass. Ein Like gibt KEINEN Kontakt frei; gegenseitige Likes werden nur
 * als Vorschlag „gegenseitiges Interesse“ angezeigt.
 */
export async function setLike(userId: string, profileId: string, targetId: string, value: "like" | "pass") {
  await assertMember(userId, profileId);
  if (profileId === targetId) throw new AppError("self", "Das ist dein eigenes Profil.");
  const t = await db.communityProfile.findUnique({ where: { id: targetId } });
  if (!t || t.status !== "active") throw notFound("Profil nicht verfügbar.");
  if (await isBlockedEitherWay(profileId, targetId)) throw forbidden("Nicht möglich.");
  await db.profileLike.upsert({
    where: { fromId_toId: { fromId: profileId, toId: targetId } },
    create: { fromId: profileId, toId: targetId, value },
    update: { value, createdAt: new Date() },
  });
  if (value !== "like") return { mutual: false };
  const back = await db.profileLike.findUnique({ where: { fromId_toId: { fromId: targetId, toId: profileId } } });
  return { mutual: back?.value === "like" };
}

export async function mutualLikes(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  const mine = await db.profileLike.findMany({ where: { fromId: profileId, value: "like" }, select: { toId: true } });
  if (!mine.length) return [];
  const back = await db.profileLike.findMany({
    where: { toId: profileId, value: "like", fromId: { in: mine.map((m) => m.toId) }, from: { status: "active" } },
    include: { from: { select: { id: true, handle: true, type: true, verifiedBadge: true } } },
  });
  const blocks = await db.block.findMany({ where: { OR: [{ blockerId: profileId }, { blockedId: profileId }] } });
  const blocked = new Set(blocks.map((b) => (b.blockerId === profileId ? b.blockedId : b.blockerId)));
  return back.filter((b) => !blocked.has(b.fromId)).map((b) => b.from);
}

export async function listBlocked(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  return db.block.findMany({ where: { blockerId: profileId }, include: { blocked: { select: { id: true, handle: true } } }, orderBy: { createdAt: "desc" } });
}
