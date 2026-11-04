import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { assertPerm, requireReason } from "./guard";

export async function moderateMedia(actorUserId: string, mediaId: string, decision: "approved" | "rejected", reasonRaw: string) {
  await assertPerm(actorUserId, "media.moderate");
  const reason = decision === "rejected" ? requireReason(reasonRaw, 3) : reasonRaw.trim().slice(0, 300);
  const m = await db.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!m || m.deletedAt) throw notFound();
  await db.mediaAsset.update({ where: { id: mediaId }, data: { moderation: decision } });
  await audit(`media.${decision}`, { actorUserId, targetType: "media", targetId: mediaId, meta: { reason: reason || null } });
}

/** Legal Hold verhindert Löschung durch Löschläufe; nur mit Begründung. */
export async function setLegalHold(actorUserId: string, mediaId: string, hold: boolean, reasonRaw: string) {
  await assertPerm(actorUserId, "media.moderate");
  const reason = requireReason(reasonRaw);
  const m = await db.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!m) throw notFound();
  if (m.legalHold === hold) throw new AppError("same", "Status ist bereits gesetzt.");
  await db.mediaAsset.update({ where: { id: mediaId }, data: { legalHold: hold } });
  await audit(hold ? "media.legal_hold_set" : "media.legal_hold_released", { actorUserId, targetType: "media", targetId: mediaId, meta: { reason } });
}
