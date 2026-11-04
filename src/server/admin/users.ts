import { db } from "../db";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { revokeAllSessions } from "../auth";
import { onRightsRevoked } from "../safety";
import { leaveCouple } from "../profiles";
import { refreshBadgesForUser } from "../state";
import { assertPerm, requireReason } from "./guard";

/** Sperren / Entsperren / Bannen. Bei Sperre/Bann: alle Sitzungen widerrufen und Rechte bereinigen. */
export async function setUserStatus(actorUserId: string, userId: string, status: "active" | "suspended" | "banned", reasonRaw: string) {
  await assertPerm(actorUserId, "users.manage");
  const reason = requireReason(reasonRaw);
  if (userId === actorUserId) throw forbidden("Das eigene Konto kann nicht gesperrt werden.");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound();
  if (u.status === "deleted") throw new AppError("deleted", "Gelöschte Konten können nicht geändert werden.");
  if (u.status === status) throw new AppError("same", "Status ist bereits gesetzt.");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status !== "active") {
    await revokeAllSessions(userId, `admin_${status}`);
    await onRightsRevoked(userId, `admin_${status}`);
  }
  await refreshBadgesForUser(userId);
  await audit(`user.${status === "active" ? "unsuspended" : status}`, { actorUserId, targetType: "user", targetId: userId, meta: { from: u.status, reason } });
}

/** Paarverknüpfung lösen: Person wird aus dem gemeinsamen Profil entfernt (gleicher Pfad wie Selbstaustritt). */
export async function dissolveCoupleLink(actorUserId: string, profileId: string, userId: string, reasonRaw: string, convertRemainingToSingle = false) {
  await assertPerm(actorUserId, "users.manage");
  const reason = requireReason(reasonRaw);
  const m = await db.profileMembership.findFirst({ where: { profileId, userId, status: "active" }, include: { profile: true } });
  if (!m || m.profile.type !== "couple") throw new AppError("not_couple", "Keine aktive Paarmitgliedschaft.");
  await leaveCouple(userId, profileId, { convertRemainingToSingle });
  await audit("admin.couple_dissolved", { actorUserId, targetType: "profile", targetId: profileId, meta: { user: userId, reason, convertRemainingToSingle } });
}

/** Löschantrag: „jetzt ausführen“ = Termin auf jetzt setzen (Status scheduled). Die Löschung selbst führt der Worker aus. */
export async function scheduleDeletionNow(actorUserId: string, requestId: string, perm: "users.manage" | "privacy.manage" = "privacy.manage") {
  await assertPerm(actorUserId, perm);
  const r = await db.deletionRequest.findUnique({ where: { id: requestId } });
  if (!r) throw notFound();
  if (!["requested", "failed"].includes(r.status)) throw new AppError("state", `Antrag mit Status „${r.status}“ kann nicht neu eingeplant werden.`);
  await db.deletionRequest.update({ where: { id: r.id }, data: { status: "scheduled", scheduledFor: new Date(), error: null } });
  await audit("privacy.deletion_scheduled", { actorUserId, targetType: "user", targetId: r.userId, meta: { request: r.id } });
}
