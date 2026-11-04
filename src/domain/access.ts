/**
 * Zugriffsregeln (Default deny). Eingaben sind bereits aufgelöste Zustände;
 * die Serverschicht lädt sie aus der Datenbank und ruft diese Funktionen auf.
 */
import { PLAN_FEATURES, type Feature, type PlanKey } from "./plans";

export type IdentityStatus =
  | "not_started" | "in_progress" | "pending_review" | "verified" | "rejected" | "expired" | "revoked";

export interface PersonState {
  userId: string;
  status: "active" | "suspended" | "banned" | "deleted";
  emailVerified: boolean;
  adultConfirmed: boolean; // Mindestanforderung für jedes Mitgliederkonto
  identityStatus: IdentityStatus;
  identityExpiresAt?: Date | null;
  plan: PlanKey; // aktive Mitgliedschaft dieser Person
}

export interface ProfileState {
  profileId: string;
  type: "single" | "couple" | "organizer";
  status: "active" | "pending_partner" | "suspended" | "dissolved" | "deleted";
  members: PersonState[]; // aktive Mitgliedschaften
}

export function personIdentityVerified(p: PersonState, now = new Date()): boolean {
  if (p.identityStatus !== "verified") return false;
  if (p.identityExpiresAt && p.identityExpiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function personActive(p: PersonState): boolean {
  return p.status === "active" && p.emailVerified && p.adultConfirmed;
}

/** Badge „Verifiziert“: alle Personen des Profils (Paar: genau zwei) geprüft. */
export function profileVerified(profile: ProfileState, now = new Date()): boolean {
  if (profile.status !== "active") return false;
  const expected = profile.type === "couple" ? 2 : 1;
  if (profile.members.length !== expected) return false;
  return profile.members.every((m) => personActive(m) && personIdentityVerified(m, now));
}

export function profileUsable(profile: ProfileState): boolean {
  return profile.status === "active" && profile.members.length > 0 && profile.members.every(personActive);
}

/** Effektiver Tarif der handelnden Person; Premium-/Gold-Rechte nur mit Identitätsprüfung. */
export function effectivePlan(actor: PersonState, profile: ProfileState, now = new Date()): PlanKey {
  if (actor.plan === "basis") return "basis";
  return profileVerified(profile, now) ? actor.plan : "basis";
}

export function hasFeature(actor: PersonState, profile: ProfileState, f: Feature, now = new Date()): boolean {
  return PLAN_FEATURES[effectivePlan(actor, profile, now)].includes(f);
}

export type Capability =
  | "view_profiles"
  | "contact_request"
  | "send_message"
  | "read_messages"
  | "community" // Gruppen, Foren, Events, Dates, Clubs
  | "games"
  | "calls"
  | "gold_content"
  | "gold_discount"
  | "group_gallery";

export interface CapabilityResult {
  allowed: boolean;
  reason?: string;
  tokenCostPerMessage?: number;
}

/**
 * Zugangsmatrix:
 *  - Jedes aktive, volljährig bestätigte Mitglied mit verifizierter E-Mail: Profile entdecken,
 *    Kontakte gegenseitig freigeben, empfangene Nachrichten lesen, mit Tokens schreiben.
 *  - Gruppen/Foren/Spiele/Premium/Gold: vollständige Identitätsprüfung (Paar: beide).
 */
export function can(cap: Capability, actor: PersonState, profile: ProfileState, now = new Date()): CapabilityResult {
  if (!personActive(actor)) return { allowed: false, reason: "Konto nicht aktiv oder E-Mail/Volljährigkeit nicht bestätigt." };
  if (!profile.members.some((m) => m.userId === actor.userId)) return { allowed: false, reason: "Kein Mitglied dieses Profils." };
  if (profile.status !== "active") return { allowed: false, reason: "Profil ist nicht aktiv." };
  const verified = profileVerified(profile, now);
  const plan = effectivePlan(actor, profile, now);

  switch (cap) {
    case "view_profiles":
    case "contact_request":
    case "read_messages":
      return { allowed: true };
    case "send_message":
      return { allowed: true, tokenCostPerMessage: PLAN_FEATURES[plan].includes("send_messages_free") ? 0 : 1 };
    case "community":
    case "games":
      return verified ? { allowed: true } : { allowed: false, reason: "Nur für vollständig verifizierte Profile." };
    case "calls":
      if (!verified) return { allowed: false, reason: "Anrufe benötigen eine vollständige Verifizierung." };
      return PLAN_FEATURES[plan].includes("calls")
        ? { allowed: true }
        : { allowed: false, reason: "Anrufe sind in Premium und Gold enthalten." };
    case "gold_content":
    case "gold_discount":
      if (!verified) return { allowed: false, reason: "Nur für vollständig verifizierte Profile." };
      return plan === "gold" ? { allowed: true } : { allowed: false, reason: "Gold-Funktion." };
    case "group_gallery":
      if (!verified) return { allowed: false, reason: "Nur für vollständig verifizierte Profile." };
      return plan === "premium" || plan === "gold"
        ? { allowed: true }
        : { allowed: false, reason: "Gruppengalerien sind in Premium und Gold enthalten." };
  }
}

/** Kontaktfilter & Blockierung haben immer Vorrang vor Tarif/Kauf. */
export interface ContactFilter {
  allowTypes?: Array<"single" | "couple" | "organizer">;
  verifiedOnly?: boolean;
  minAge?: number;
  maxAge?: number;
}

export function passesContactFilter(
  filter: ContactFilter | null | undefined,
  sender: { type: "single" | "couple" | "organizer"; verified: boolean; ages: number[] },
): boolean {
  if (!filter) return true;
  if (filter.allowTypes && filter.allowTypes.length > 0 && !filter.allowTypes.includes(sender.type)) return false;
  if (filter.verifiedOnly && !sender.verified) return false;
  if (filter.minAge && sender.ages.some((a) => a < filter.minAge!)) return false;
  if (filter.maxAge && sender.ages.some((a) => a > filter.maxAge!)) return false;
  return true;
}
