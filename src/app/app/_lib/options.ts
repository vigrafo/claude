/** Gemeinsame Auswahllisten des Mitgliederbereichs (reine Konstanten, client- und serverseitig nutzbar). */

export const LOOKING_FOR: { key: string; label: string }[] = [
  { key: "dating", label: "Dating" },
  { key: "freundschaft", label: "Freundschaft" },
  { key: "paare", label: "Kontakt zu Paaren" },
  { key: "singles", label: "Kontakt zu Singles" },
  { key: "gruppen", label: "Gruppen & Stammtische" },
  { key: "events", label: "Events & Partys" },
  { key: "austausch", label: "Austausch & Gespräche" },
];

export const RELATIONSHIP_FORMS: { key: string; label: string }[] = [
  { key: "", label: "Keine Angabe" },
  { key: "single", label: "Single" },
  { key: "beziehung", label: "Feste Beziehung" },
  { key: "offen", label: "Offene Beziehung" },
  { key: "ehe", label: "Verheiratet" },
  { key: "poly", label: "Polyamor" },
];

export const REPORT_REASONS: { key: string; label: string; priority: number }[] = [
  { key: "minor", label: "Verdacht auf minderjährige Person", priority: 100 },
  { key: "non_consensual", label: "Nicht einvernehmliche Inhalte", priority: 90 },
  { key: "threat", label: "Bedrohung oder Erpressung", priority: 90 },
  { key: "harassment", label: "Belästigung", priority: 50 },
  { key: "fake", label: "Fake-Profil oder Identitätsmissbrauch", priority: 40 },
  { key: "scam", label: "Betrug oder Spam", priority: 40 },
  { key: "commercial", label: "Unerlaubte kommerzielle Angebote", priority: 30 },
  { key: "other", label: "Sonstiges", priority: 10 },
];

export const PROFILE_TYPE_LABEL: Record<string, string> = { single: "Einzelprofil", couple: "Paar", organizer: "Veranstalter" };

export function lookingForLabel(key: string): string {
  return LOOKING_FOR.find((x) => x.key === key)?.label ?? key;
}

export function relationshipLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return RELATIONSHIP_FORMS.find((x) => x.key === key)?.label ?? key;
}

/** Normalisiert Links aus Benachrichtigungen auf den Mitgliederbereich. */
export function memberLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/")) return null;
  return link.startsWith("/app") ? link : `/app${link}`;
}

export function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}
