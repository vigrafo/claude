import { DEFAULT_PRICES, PLAN_LABEL, type PlanKey } from "@/domain/plans";

export { DEFAULT_PRICES, PLAN_LABEL };

export function effectivePlanLabel(plan: PlanKey, verified: boolean): string {
  if (plan === "basis") return "Profile entdecken, Kontaktanfragen, Nachrichten lesen und mit Tokens schreiben.";
  if (!verified) return "Deine Premium-/Gold-Vorteile wirken erst, wenn euer Profil vollständig verifiziert ist.";
  return plan === "gold" ? "Alles aus Premium plus Gold-Bibliothek und Party-Rabatt." : "Nachrichten ohne Tokenkosten, Anrufe, Gruppengalerien.";
}
