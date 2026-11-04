/**
 * Tarifregeln eropub. Reine Funktionen ohne I/O – von Server, UI und Tests gemeinsam genutzt.
 *
 * Verbindliche Premium-Regel: Einführungspreis 7 € für 24 Kalendermonate ab der ERSTEN
 * Premium- (oder Gold-)Aktivierung je Person. Danach 14 €. Kündigung/Neubuchung setzt die
 * Frist nicht zurück, Pausen verlängern sie nicht. Der höhere Preis gilt ab dem ersten
 * Abrechnungszeitraum, der am oder nach dem Fristende beginnt.
 */

export type PlanKey = "basis" | "premium" | "gold";

export const PLAN_LABEL: Record<PlanKey, string> = {
  basis: "Basis",
  premium: "Premium",
  gold: "Gold",
};

export const DEFAULT_PRICES = {
  premiumIntroCents: 700,
  premiumIntroMonths: 24,
  premiumRegularCents: 1400,
  goldCents: 2500,
  currency: "EUR",
} as const;

export type Feature =
  | "discover"
  | "games"
  | "groups_read_write"
  | "groups_apply"
  | "read_messages"
  | "send_messages_free"
  | "calls"
  | "gold_content"
  | "gold_party_discount"
  | "safety_tools";

export const PLAN_FEATURES: Record<PlanKey, Feature[]> = {
  basis: ["discover", "games", "groups_read_write", "groups_apply", "read_messages", "safety_tools"],
  premium: [
    "discover", "games", "groups_read_write", "groups_apply", "read_messages", "safety_tools",
    "send_messages_free", "calls",
  ],
  gold: [
    "discover", "games", "groups_read_write", "groups_apply", "read_messages", "safety_tools",
    "send_messages_free", "calls", "gold_content", "gold_party_discount",
  ],
};

/** Addiert Kalendermonate (UTC) und klemmt auf Monatsende (31.01. + 1 Monat = 28./29.02.). */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const d = Math.min(date.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(targetY, targetM, d, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()),
  );
}

export function introPriceEndsAt(firstActivatedAt: Date, introMonths = DEFAULT_PRICES.premiumIntroMonths): Date {
  return addMonthsUtc(firstActivatedAt, introMonths);
}

export interface PremiumPriceInput {
  /** Beginn des abzurechnenden Monatszeitraums */
  periodStart: Date;
  /** Unveränderlich gespeichertes Fristende; null = noch nie Premium/Gold → Periode startet die Frist */
  introEndsAt: Date | null;
  introCents?: number;
  regularCents?: number;
}

/** Preis eines Premium-Abrechnungszeitraums. Keine taggenaue Nachforderung im laufenden Monat. */
export function premiumPriceForPeriod(input: PremiumPriceInput): number {
  const intro = input.introCents ?? DEFAULT_PRICES.premiumIntroCents;
  const regular = input.regularCents ?? DEFAULT_PRICES.premiumRegularCents;
  if (input.introEndsAt === null) return intro;
  return input.periodStart.getTime() >= input.introEndsAt.getTime() ? regular : intro;
}

export function priceForPeriod(plan: PlanKey, periodStart: Date, introEndsAt: Date | null): number {
  if (plan === "basis") return 0;
  if (plan === "gold") return DEFAULT_PRICES.goldCents;
  return premiumPriceForPeriod({ periodStart, introEndsAt });
}

/** Datum, ab dem erstmals der höhere Preis abgebucht wird – für Hinweis in Konto & Checkout. */
export function firstRegularChargeDate(periodAnchor: Date, introEndsAt: Date): Date {
  // Erster Periodenbeginn (Anker + n Monate) am oder nach dem Fristende
  let n = 0;
  let d = periodAnchor;
  while (d.getTime() < introEndsAt.getTime()) {
    n += 1;
    d = addMonthsUtc(periodAnchor, n);
  }
  return d;
}

export const PRICE_NOTICE_DAYS = 30;

export function priceNoticeDue(now: Date, firstRegularCharge: Date, noticeDays = PRICE_NOTICE_DAYS): boolean {
  const diff = firstRegularCharge.getTime() - now.getTime();
  return diff <= noticeDays * 86_400_000 && diff > 0;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Wechselmatrix: Upgrade sofort (anteilige Gutschrift durch Anbieter, keine Doppelbelastung), Downgrade zum Periodenende. */
export type PlanChange = "upgrade_now" | "downgrade_at_period_end" | "none";
export function planChangeKind(from: PlanKey, to: PlanKey): PlanChange {
  const rank: Record<PlanKey, number> = { basis: 0, premium: 1, gold: 2 };
  if (rank[to] > rank[from]) return "upgrade_now";
  if (rank[to] < rank[from]) return "downgrade_at_period_end";
  return "none";
}
