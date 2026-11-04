import { db, isUniqueViolation } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { audit } from "./audit";
import { enqueue } from "./outbox";
import { rateLimit } from "./ratelimit";
import { assertMember } from "./contacts";
import { REPORT_REASONS } from "@/app/app/_lib/options";

/**
 * Meldungen: jede Meldung wird einem offenen Moderationsfall je Ziel zugeordnet (oder legt einen an,
 * Nummer „M-000001“). Priorität richtet sich nach dem schwersten gemeldeten Grund.
 * Meldende Personen müssen das Ziel sehen dürfen (keine Meldungen über erratene IDs).
 */

export const REPORT_TARGETS = ["profile", "message", "post", "event", "media", "group", "club", "date"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

const OPEN_CASE = ["open", "in_review", "appealed"];

async function assertTargetVisible(profileId: string, type: ReportTarget, id: string) {
  switch (type) {
    case "profile": {
      const p = await db.communityProfile.findUnique({ where: { id } });
      if (!p || p.id === profileId) throw notFound("Ziel nicht gefunden.");
      return;
    }
    case "message": {
      const m = await db.message.findUnique({ where: { id } });
      if (!m) throw notFound("Ziel nicht gefunden.");
      const part = await db.conversationParticipant.findUnique({ where: { conversationId_profileId: { conversationId: m.conversationId, profileId } } });
      if (!part || m.senderProfileId === profileId) throw forbidden();
      return;
    }
    case "post": {
      const p = await db.post.findUnique({ where: { id }, include: { thread: { include: { category: { include: { group: true } } } } } });
      if (!p) throw notFound("Ziel nicht gefunden.");
      const g = p.thread.category.group;
      if (g && g.visibility !== "open") {
        const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId: g.id, profileId } } });
        if (m?.status !== "active") throw forbidden();
      }
      return;
    }
    case "event": if (!(await db.event.findUnique({ where: { id } }))) throw notFound("Ziel nicht gefunden."); return;
    case "media": if (!(await db.mediaAsset.findUnique({ where: { id } }))) throw notFound("Ziel nicht gefunden."); return;
    case "group": if (!(await db.group.findUnique({ where: { id } }))) throw notFound("Ziel nicht gefunden."); return;
    case "club": if (!(await db.club.findUnique({ where: { id } }))) throw notFound("Ziel nicht gefunden."); return;
    case "date": if (!(await db.dateOffer.findUnique({ where: { id } }))) throw notFound("Ziel nicht gefunden."); return;
  }
}

function caseNumber(n: number) {
  return `M-${String(n).padStart(6, "0")}`;
}

export async function createReport(
  userId: string, profileId: string,
  input: { targetType: string; targetId: string; reason: string; details?: string },
) {
  await assertMember(userId, profileId);
  if (!REPORT_TARGETS.includes(input.targetType as ReportTarget)) throw new AppError("target", "Unbekanntes Meldeziel.");
  const reason = REPORT_REASONS.find((r) => r.key === input.reason);
  if (!reason) throw new AppError("reason", "Bitte wähle einen Grund.");
  const details = (input.details ?? "").trim();
  if ([...details].length > 2000) throw new AppError("details", "Höchstens 2000 Zeichen.");
  await rateLimit("report", userId, 30, 3600);
  const type = input.targetType as ReportTarget;
  await assertTargetVisible(profileId, type, input.targetId);

  const dueHours = reason.priority >= 90 ? 24 : 72;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await db.$transaction(async (tx) => {
        // Fälle je Ziel serialisieren
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`case:${type}:${input.targetId}`}))`;
        let mc = await tx.moderationCase.findFirst({ where: { targetType: type, targetId: input.targetId, status: { in: OPEN_CASE } }, orderBy: { createdAt: "desc" } });
        if (mc) {
          if (reason.priority > mc.priority) {
            mc = await tx.moderationCase.update({ where: { id: mc.id }, data: { priority: reason.priority, dueAt: new Date(Date.now() + dueHours * 3600_000) } });
          }
        } else {
          const count = await tx.moderationCase.count();
          mc = await tx.moderationCase.create({
            data: { number: caseNumber(count + 1 + attempt), targetType: type, targetId: input.targetId, priority: reason.priority, dueAt: new Date(Date.now() + dueHours * 3600_000) },
          });
          await enqueue(tx, "admin.notify", { kind: "moderation_case", summary: "Neue Meldung", number: mc.number, link: `/admin/moderation/${mc.id}` });
        }
        const report = await tx.report.create({
          data: { reporterUserId: userId, reporterProfileId: profileId, targetType: type, targetId: input.targetId, reason: reason.key, details: details || null, caseId: mc.id },
        });
        await audit("report.created", { actorUserId: userId, targetType: type, targetId: input.targetId, meta: { case: mc.number, reason: reason.key } }, tx);
        return { report, caseNumber: mc.number, caseId: mc.id };
      });
      return result;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue; // Fallnummer parallel vergeben → erneut
      throw e;
    }
  }
  throw new AppError("retry", "Bitte erneut versuchen.");
}
