import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { reviewerDecision } from "../verification";
import { assertPerm, requireReason } from "./guard";

/** Prüferentscheidung – Volljährigkeitsregel erzwingt reviewerDecision selbst (Fehler wird angezeigt). */
export async function decideCase(actorUserId: string, caseId: string, decision: "verified" | "rejected" | "revoked", reasonRaw: string) {
  await assertPerm(actorUserId, "verification.review");
  const reason = requireReason(reasonRaw, 3);
  return reviewerDecision(actorUserId, caseId, decision, reason);
}

/** Nachforderung: Fall wird mit Grund „Nachforderung“ abgelehnt – die Person kann neu einreichen. */
export async function requestResubmission(actorUserId: string, caseId: string, detail: string) {
  await assertPerm(actorUserId, "verification.review");
  const d = detail.trim().slice(0, 300);
  return reviewerDecision(actorUserId, caseId, "rejected", d ? `Nachforderung: ${d}` : "Nachforderung");
}

/**
 * Belegzugriff: nur mit verification.evidence, Zweckangabe und Audit.
 * Es werden keine Ausweisbilder gespeichert; ist tempEvidenceKey leer, gibt es nichts anzuzeigen.
 */
export async function accessEvidence(actorUserId: string, caseId: string, purposeRaw: string) {
  await assertPerm(actorUserId, "verification.evidence");
  const purpose = requireReason(purposeRaw, 10);
  const c = await db.verificationCase.findUnique({ where: { id: caseId } });
  if (!c) throw notFound();
  if (c.userId === actorUserId) throw new AppError("own_case", "Eigene Fälle sind ausgeschlossen.", 403);
  await audit("verification.evidence_access", { actorUserId, targetType: "verification", targetId: caseId, meta: { purpose, present: !!c.tempEvidenceKey } });
  return { present: !!c.tempEvidenceKey, purgeAt: c.evidencePurgeAt };
}
