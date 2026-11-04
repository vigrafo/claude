import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { assertPerm, requireReason } from "./guard";

/** Veranstalterprüfung: Freigabe/Ablehnung/Sperre und Partnerstatus (nur mit Vertragsreferenz). */
export async function decideOrganizer(actorUserId: string, organizerId: string, status: "approved" | "rejected" | "suspended", reasonRaw: string) {
  await assertPerm(actorUserId, "events.manage");
  const reason = requireReason(reasonRaw, 3);
  const o = await db.organizer.findUnique({ where: { id: organizerId } });
  if (!o) throw notFound();
  if (o.responsibleUserId === actorUserId) throw new AppError("own", "Eigene Veranstalterprofile sind ausgeschlossen.", 403);
  await db.organizer.update({ where: { id: organizerId }, data: { status, ...(status !== "approved" ? { isPartner: false } : {}) } });
  await audit(`organizer.${status}`, { actorUserId, targetType: "organizer", targetId: organizerId, meta: { reason } });
}

export async function setOrganizerPartner(actorUserId: string, organizerId: string, isPartner: boolean, contractRef: string) {
  await assertPerm(actorUserId, "events.manage");
  const o = await db.organizer.findUnique({ where: { id: organizerId } });
  if (!o) throw notFound();
  const ref = contractRef.trim();
  if (isPartner && o.status !== "approved") throw new AppError("state", "Partnerstatus nur für freigegebene Veranstalter.");
  if (isPartner && (ref.length < 3 || ref.length > 80)) throw new AppError("contract", "Partnerstatus nur mit Vertragsreferenz (3–80 Zeichen).");
  await db.organizer.update({ where: { id: organizerId }, data: { isPartner, partnerContractRef: isPartner ? ref : null } });
  if (!isPartner) {
    // Gold-Rabattfähigkeit hängt am Partnerstatus
    await db.event.updateMany({ where: { organizerId, isEropubEvent: false, goldDiscountEligible: true }, data: { goldDiscountEligible: false } });
  }
  await audit(isPartner ? "organizer.partner_set" : "organizer.partner_removed", { actorUserId, targetType: "organizer", targetId: organizerId, meta: { contractRef: isPartner ? ref : null } });
}

export async function decideClub(actorUserId: string, clubId: string, status: "approved" | "rejected" | "suspended", reasonRaw: string) {
  await assertPerm(actorUserId, "events.manage");
  const reason = requireReason(reasonRaw, 3);
  const c = await db.club.findUnique({ where: { id: clubId } });
  if (!c) throw notFound();
  await db.club.update({ where: { id: clubId }, data: { status } });
  await audit(`club.${status}`, { actorUserId, targetType: "club", targetId: clubId, meta: { reason } });
}
