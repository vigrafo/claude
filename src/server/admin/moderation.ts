import { db } from "../db";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { hasPermission } from "../rbac";
import { assertPerm, requireReason } from "./guard";

export const CASE_STATUSES = ["open", "in_review", "actioned", "dismissed", "appealed", "closed"] as const;
export const MOD_ACTIONS = ["note", "hide", "remove", "warn", "suspend", "restore"] as const;
export type ModAction = (typeof MOD_ACTIONS)[number];

function caseNumber() {
  return `MC-${new Date().getUTCFullYear()}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}

/** Meldung einem Fall zuordnen (bestehender offener Fall zum selben Ziel oder neuer Fall). */
export async function caseForReport(actorUserId: string, reportId: string) {
  const ok = (await hasPermission(actorUserId, "moderation.handle")) || (await hasPermission(actorUserId, "messages.moderate"));
  if (!ok) throw forbidden();
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r) throw notFound();
  if (r.caseId) return r.caseId;
  let c = await db.moderationCase.findFirst({ where: { targetType: r.targetType, targetId: r.targetId, status: { in: ["open", "in_review", "appealed"] } } });
  if (!c) c = await db.moderationCase.create({ data: { number: caseNumber(), targetType: r.targetType, targetId: r.targetId, dueAt: new Date(Date.now() + 2 * 86400_000) } });
  await db.report.update({ where: { id: r.id }, data: { caseId: c.id } });
  await audit("moderation.case_linked", { actorUserId, targetType: "moderation_case", targetId: c.id, meta: { report: r.id } });
  return c.id;
}

async function ownersOf(targetType: string, targetId: string): Promise<string[]> {
  let profileId: string | null = null;
  if (targetType === "profile") profileId = targetId;
  if (targetType === "post") profileId = (await db.post.findUnique({ where: { id: targetId } }))?.authorId ?? null;
  if (targetType === "media") profileId = (await db.mediaAsset.findUnique({ where: { id: targetId } }))?.ownerId ?? null;
  if (targetType === "message") profileId = (await db.message.findUnique({ where: { id: targetId } }))?.senderProfileId ?? null;
  if (!profileId) return [];
  const ms = await db.profileMembership.findMany({ where: { profileId, status: "active" } });
  return ms.map((m) => m.userId);
}

/** Wirkung je Zieltyp. Nicht unterstützte Kombinationen werden abgelehnt statt still ignoriert. */
async function applyEffect(targetType: string, targetId: string, action: ModAction) {
  if (action === "note") return;
  const hide = action === "hide" || action === "remove";
  const restore = action === "restore";
  switch (targetType) {
    case "post":
      if (hide || restore) return void (await db.post.update({ where: { id: targetId }, data: { hidden: hide } }));
      break;
    case "media":
      if (hide || restore) return void (await db.mediaAsset.update({ where: { id: targetId }, data: { moderation: hide ? "rejected" : "approved" } }));
      break;
    case "message":
      if (hide || restore) return void (await db.message.update({ where: { id: targetId }, data: { deletedAt: hide ? new Date() : null } }));
      break;
    case "profile":
      if (action === "suspend" || hide || restore) {
        return void (await db.communityProfile.update({ where: { id: targetId }, data: { status: restore ? "active" : "suspended" } }));
      }
      break;
    case "group":
      if (action === "suspend" || hide || restore) {
        return void (await db.group.update({ where: { id: targetId }, data: { status: restore ? "approved" : "suspended" } }));
      }
      break;
    case "event":
      if (hide) return void (await db.event.update({ where: { id: targetId }, data: { status: "canceled" } }));
      break;
    case "club":
      if (action === "suspend" || hide || restore) {
        return void (await db.club.update({ where: { id: targetId }, data: { status: restore ? "approved" : "suspended" } }));
      }
      break;
  }
  if (action === "warn") return;
  throw new AppError("unsupported", `Aktion „${action}“ ist für ${targetType} nicht verfügbar.`);
}

export async function moderationAction(actorUserId: string, caseId: string, action: ModAction, reasoningRaw: string) {
  await assertPerm(actorUserId, "moderation.handle");
  if (!MOD_ACTIONS.includes(action)) throw new AppError("action", "Unbekannte Aktion.");
  const reasoning = requireReason(reasoningRaw);
  const c = await db.moderationCase.findUnique({ where: { id: caseId } });
  if (!c) throw notFound();
  if (c.status === "closed" && action !== "note") throw new AppError("closed", "Fall ist geschlossen.");
  await applyEffect(c.targetType, c.targetId, action);
  if (action === "warn") {
    for (const userId of await ownersOf(c.targetType, c.targetId)) {
      await db.notification.create({ data: { userId, kind: "moderation", title: "Hinweis der Moderation zu einem deiner Inhalte" } });
    }
  }
  await db.moderationAction.create({ data: { caseId, actorId: actorUserId, action, note: reasoning } });
  await db.moderationCase.update({
    where: { id: caseId },
    data: action === "note"
      ? { status: c.status === "open" ? "in_review" : c.status }
      : { status: "actioned", decision: action, reasoning },
  });
  await audit(`moderation.${action}`, { actorUserId, targetType: "moderation_case", targetId: caseId, meta: { target: c.targetType } });
}

export async function updateCase(actorUserId: string, caseId: string, input: { status?: string; assigneeId?: string | null; dueAt?: Date | null; priority?: number }) {
  await assertPerm(actorUserId, "moderation.handle");
  const c = await db.moderationCase.findUnique({ where: { id: caseId } });
  if (!c) throw notFound();
  if (input.status && !CASE_STATUSES.includes(input.status as (typeof CASE_STATUSES)[number])) throw new AppError("status", "Ungültiger Status.");
  if (input.assigneeId && !(await hasPermission(input.assigneeId, "moderation.handle"))) throw new AppError("assignee", "Zuweisung nur an Moderationsberechtigte.");
  if (input.priority != null && (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 10)) throw new AppError("priority", "Priorität 0–10.");
  await db.moderationCase.update({
    where: { id: caseId },
    data: { status: input.status, assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId, dueAt: input.dueAt === undefined ? undefined : input.dueAt, priority: input.priority },
  });
  await audit("moderation.case_updated", { actorUserId, targetType: "moderation_case", targetId: caseId, meta: { ...input, dueAt: input.dueAt?.toISOString() ?? input.dueAt } });
}

/** Einspruch: erfassen (Status appealed) und entscheiden (bestätigen = schließen, stattgeben = wiederherstellen). */
export async function recordAppeal(actorUserId: string, caseId: string, appeal: string) {
  await assertPerm(actorUserId, "moderation.handle");
  const t = appeal.trim();
  if (t.length < 5) throw new AppError("appeal", "Einspruchstext angeben.");
  await db.moderationCase.update({ where: { id: caseId }, data: { status: "appealed", appealText: t.slice(0, 2000) } });
  await audit("moderation.appeal_recorded", { actorUserId, targetType: "moderation_case", targetId: caseId });
}

export async function decideAppeal(actorUserId: string, caseId: string, overturn: boolean, reasoningRaw: string) {
  await assertPerm(actorUserId, "moderation.handle");
  const reasoning = requireReason(reasoningRaw);
  const c = await db.moderationCase.findUnique({ where: { id: caseId } });
  if (!c) throw notFound();
  if (c.status !== "appealed") throw new AppError("state", "Kein offener Einspruch.");
  if (overturn) await applyEffect(c.targetType, c.targetId, "restore").catch(() => undefined);
  await db.moderationAction.create({ data: { caseId, actorId: actorUserId, action: overturn ? "restore" : "note", note: `Einspruch ${overturn ? "stattgegeben" : "abgelehnt"}: ${reasoning}` } });
  await db.moderationCase.update({ where: { id: caseId }, data: { status: "closed", reasoning } });
  await audit(overturn ? "moderation.appeal_granted" : "moderation.appeal_rejected", { actorUserId, targetType: "moderation_case", targetId: caseId });
}

export const EVIDENCE_VIEW_MINUTES = 15;

/**
 * Einsicht in eine gemeldete Nachricht: nur fallbezogen, mit moderation.evidence, Zweckangabe,
 * ModerationAction „evidence_access“ und Audit. Kein Postfach-Browsing.
 */
export async function accessMessageEvidence(actorUserId: string, reportId: string, purposeRaw: string) {
  await assertPerm(actorUserId, "messages.moderate");
  await assertPerm(actorUserId, "moderation.evidence");
  const purpose = requireReason(purposeRaw, 10);
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r || r.targetType !== "message") throw notFound();
  if (!r.caseId) throw new AppError("no_case", "Bitte zuerst einen Moderationsfall anlegen.");
  const a = await db.moderationAction.create({ data: { caseId: r.caseId, actorId: actorUserId, action: "evidence_access", purpose, note: `report:${r.id}` } });
  await audit("moderation.evidence_access", { actorUserId, targetType: "report", targetId: r.id, meta: { case: r.caseId, purpose } });
  return a.id;
}

/** Prüft, ob ein frischer, eigener Belegzugriff zu genau dieser Meldung vorliegt – erst dann wird der Inhalt geladen. */
export async function evidenceGrant(actorUserId: string, reportId: string, accessId: string) {
  const a = await db.moderationAction.findUnique({ where: { id: accessId } });
  if (!a || a.action !== "evidence_access" || a.actorId !== actorUserId || a.note !== `report:${reportId}`) return null;
  if (Date.now() - a.createdAt.getTime() > EVIDENCE_VIEW_MINUTES * 60_000) return null;
  if (!(await hasPermission(actorUserId, "moderation.evidence"))) return null;
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r || r.targetType !== "message") return null;
  const m = await db.message.findUnique({ where: { id: r.targetId }, select: { id: true, body: true, kind: true, createdAt: true, senderLabel: true, deletedAt: true, senderProfile: { select: { handle: true } } } });
  return m;
}

// ───────────── Support ─────────────

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;

export async function replyTicket(actorUserId: string, ticketId: string, body: string, internal: boolean) {
  await assertPerm(actorUserId, "support.handle");
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) throw notFound();
  const text = body.trim();
  if (text.length < 2 || text.length > 5000) throw new AppError("body", "Antwort: 2–5000 Zeichen.");
  await db.supportReply.create({ data: { ticketId, authorId: actorUserId, internal, body: text } });
  if (!internal) {
    if (t.requesterId) await db.notification.create({ data: { userId: t.requesterId, kind: "support", title: `Antwort zu deiner Anfrage ${t.number}` } });
    if (t.status === "open") await db.supportTicket.update({ where: { id: t.id }, data: { status: "pending" } });
  }
  await audit(internal ? "support.note" : "support.reply", { actorUserId, targetType: "ticket", targetId: ticketId });
}

export async function updateTicket(actorUserId: string, ticketId: string, input: { status?: string; assignToMe?: boolean; unassign?: boolean }) {
  await assertPerm(actorUserId, "support.handle");
  if (input.status && !TICKET_STATUSES.includes(input.status as (typeof TICKET_STATUSES)[number])) throw new AppError("status", "Ungültiger Status.");
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) throw notFound();
  await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: input.status, assigneeId: input.assignToMe ? actorUserId : input.unassign ? null : undefined },
  });
  await audit("support.ticket_updated", { actorUserId, targetType: "ticket", targetId: ticketId, meta: { status: input.status ?? null, assign: input.assignToMe ? "me" : input.unassign ? "none" : null } });
}
