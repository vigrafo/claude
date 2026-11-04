import { db } from "./db";
import { AppError, forbidden } from "./errors";
import { audit } from "./audit";
import { refreshBadgesForUser } from "./state";
import { onRightsRevoked } from "./safety";
import { hmac, safeEqual } from "./crypto";

/**
 * Identitäts-/Altersverifikation über einen konfigurierbaren Anbieteradapter.
 * Gespeichert werden nur minimierte Nachweise: pseudonyme Anbieterreferenz, bestätigte Volljährigkeit,
 * Ergebnis, Zeitpunkt, Gültigkeit. Ausweisbilder verarbeitet der Anbieter in seinem Prozess.
 *
 * WICHTIG: Der Testadapter ist eine Simulation und schaltet in Produktion niemals frei.
 * Ein KJM-konformes Gesamtverfahren (inkl. Authentifizierung bei Folgezugriffen) ist mit dem
 * gewählten Anbieter nachzuweisen – siehe docs/verification.md.
 */
export interface IdentityProvider {
  key: string;
  displayName: string;
  isAvailable(): boolean;
  start(caseId: string, opts: { documentType: string; country: string; returnUrl: string }): Promise<{ redirectUrl: string; providerRef: string }>;
}

export const testIdentityProvider: IdentityProvider = {
  key: "test",
  displayName: "Test-Verifizierung (Simulation)",
  isAvailable: () => process.env.APP_ENV !== "production" && process.env.ENABLE_TEST_ADAPTERS === "true",
  async start(caseId, opts) {
    return { redirectUrl: `/verifizierung/test?case=${caseId}&doc=${opts.documentType}`, providerRef: `testref_${caseId}` };
  },
};

export const IDENTITY_PROVIDERS: IdentityProvider[] = [testIdentityProvider];

export const SUPPORTED_DOCUMENTS = [
  { key: "id_card", label: "Personalausweis / ID-Karte", sides: ["Vorderseite", "Rückseite"] },
  { key: "passport", label: "Reisepass", sides: ["Lichtbild-/Datenseite"] },
  { key: "residence_permit", label: "Aufenthaltstitel", sides: ["Vorderseite", "Rückseite"] },
] as const;

export async function startVerification(userId: string, documentType: string, country: string) {
  const provider = IDENTITY_PROVIDERS.find((p) => p.isAvailable());
  if (!provider) throw new AppError("no_provider", "Die Identitätsprüfung ist derzeit noch nicht angebunden. Wir informieren dich, sobald sie verfügbar ist.", 503);
  if (!SUPPORTED_DOCUMENTS.some((d) => d.key === documentType)) throw new AppError("doc", "Dokumenttyp nicht unterstützt.");
  const open = await db.verificationCase.findFirst({ where: { userId, status: { in: ["in_progress", "pending_review"] } } });
  if (open) return { caseId: open.id, redirectUrl: `/app/verifizierung?case=${open.id}` };
  const c = await db.verificationCase.create({ data: { userId, provider: provider.key, documentType, documentCountry: country, status: "in_progress" } });
  const r = await provider.start(c.id, { documentType, country, returnUrl: "/verifizierung" });
  await db.verificationCase.update({ where: { id: c.id }, data: { providerRef: r.providerRef } });
  await db.user.update({ where: { id: userId }, data: { identityStatus: "in_progress" } });
  await audit("verification.started", { actorUserId: userId, targetType: "verification", targetId: c.id, meta: { provider: provider.key } });
  return { caseId: c.id, redirectUrl: r.redirectUrl };
}

/** Anbieter-Callback (signiert). Ergebnis „verified“ nur mit bestätigter Volljährigkeit. */
export async function applyProviderResult(input: {
  provider: string; providerRef: string; result: "verified" | "rejected" | "needs_review"; adult: boolean; validUntil?: Date; reason?: string;
  signature: string; rawBody: string;
}) {
  const provider = IDENTITY_PROVIDERS.find((p) => p.key === input.provider);
  if (!provider || !provider.isAvailable()) throw new AppError("provider", "Anbieter nicht aktiv.", 503);
  const secret = process.env.IDENTITY_WEBHOOK_SECRET ?? (input.provider === "test" ? "local-identity-secret" : "");
  if (!secret || !safeEqual(input.signature, hmac(secret, input.rawBody))) throw new AppError("bad_signature", "Signatur ungültig.", 401);
  const c = await db.verificationCase.findUnique({ where: { provider_providerRef: { provider: input.provider, providerRef: input.providerRef } } });
  if (!c) throw new AppError("not_found", "Fall unbekannt.", 404);
  if (c.status === "verified" || c.status === "rejected") return c; // idempotent
  const status = input.result === "verified" && input.adult ? "verified" : input.result === "needs_review" ? "pending_review" : "rejected";
  return finalize(c.id, c.userId, status, { adult: input.adult, validUntil: input.validUntil, reason: input.reason, actor: null });
}

async function finalize(
  caseId: string, userId: string, status: "verified" | "rejected" | "pending_review" | "revoked" | "expired",
  o: { adult?: boolean; validUntil?: Date; reason?: string; actor: string | null },
) {
  const now = new Date();
  const updated = await db.verificationCase.update({
    where: { id: caseId },
    data: {
      status, adultConfirmed: o.adult ?? undefined, decidedAt: status === "pending_review" ? null : now,
      decidedById: o.actor, reason: o.reason, expiresAt: o.validUntil,
      tempEvidenceKey: status === "pending_review" ? undefined : null,
    },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      identityStatus: status,
      identityVerifiedAt: status === "verified" ? now : undefined,
      identityExpiresAt: status === "verified" ? o.validUntil ?? null : undefined,
      ageAssuredAt: status === "verified" && o.adult ? now : undefined,
    },
  });
  await refreshBadgesForUser(userId);
  if (status === "revoked" || status === "expired") await onRightsRevoked(userId, `verification_${status}`);
  await audit(`verification.${status}`, { actorUserId: o.actor, targetType: "verification", targetId: caseId, meta: { reason: o.reason ?? null } });
  return updated;
}

/** Manuelle Ergänzungsprüfung durch berechtigte Prüfer (ersetzt keine technischen Prüfschritte). */
export async function reviewerDecision(actorUserId: string, caseId: string, decision: "verified" | "rejected" | "revoked", reason: string) {
  const c = await db.verificationCase.findUnique({ where: { id: caseId } });
  if (!c) throw new AppError("not_found", "Fall unbekannt.", 404);
  if (c.userId === actorUserId) throw forbidden("Eigene Fälle dürfen nicht entschieden werden.");
  if (decision === "verified" && c.adultConfirmed !== true) {
    throw new AppError("adult_unconfirmed", "Freigabe nur mit technisch bestätigter Volljährigkeit durch den Anbieter.");
  }
  if (!reason.trim()) throw new AppError("reason", "Begründung erforderlich.");
  return finalize(c.id, c.userId, decision, { actor: actorUserId, reason, validUntil: c.expiresAt ?? undefined, adult: c.adultConfirmed ?? undefined });
}

export async function appealVerification(userId: string, caseId: string, text: string) {
  const c = await db.verificationCase.findFirst({ where: { id: caseId, userId, status: "rejected" } });
  if (!c) throw new AppError("not_found", "Kein ablehnbarer Fall.", 404);
  await db.verificationCase.update({ where: { id: c.id }, data: { appealText: text.slice(0, 2000), appealAt: new Date(), status: "pending_review", priority: 5 } });
  await db.user.update({ where: { id: userId }, data: { identityStatus: "pending_review" } });
}

/** Job: abgelaufene Verifizierungen entziehen. */
export async function expireVerifications(now = new Date()) {
  const users = await db.user.findMany({ where: { identityStatus: "verified", identityExpiresAt: { lte: now } } });
  for (const u of users) {
    const c = await db.verificationCase.findFirst({ where: { userId: u.id, status: "verified" }, orderBy: { createdAt: "desc" } });
    if (c) await finalize(c.id, u.id, "expired", { actor: null, reason: "Gültigkeit abgelaufen" });
  }
  return users.length;
}

/** Job: temporäre Belege nach Frist löschen. */
export async function purgeEvidence(now = new Date()) {
  const r = await db.verificationCase.updateMany({ where: { evidencePurgeAt: { lte: now }, tempEvidenceKey: { not: null } }, data: { tempEvidenceKey: null } });
  return r.count;
}
