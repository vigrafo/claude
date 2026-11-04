import type { PermissionKey } from "@/server/rbac";

export interface NavItem { href: string; label: string; perm: PermissionKey }
export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  { group: "Übersicht", items: [{ href: "/admin", label: "Dashboard", perm: "dashboard.view" }] },
  {
    group: "Mitglieder",
    items: [
      { href: "/admin/personen", label: "Personen & Profile", perm: "users.read" },
      { href: "/admin/verifizierung", label: "Verifizierung", perm: "verification.review" },
      { href: "/admin/rollen", label: "Rollen & Rechte", perm: "roles.manage" },
    ],
  },
  {
    group: "Geld",
    items: [
      { href: "/admin/tarife", label: "Tarife", perm: "plans.manage" },
      { href: "/admin/tokens", label: "Tokens", perm: "tokens.manage" },
      { href: "/admin/zahlungsanbieter", label: "Zahlungsanbieter", perm: "providers.manage" },
      { href: "/admin/finanzen", label: "Finanzen", perm: "finance.read" },
      { href: "/admin/rabatte", label: "Gold-Rabatte", perm: "discounts.manage" },
    ],
  },
  {
    group: "Community",
    items: [
      { href: "/admin/matching", label: "Matching", perm: "matching.manage" },
      { href: "/admin/spiele", label: "Spiele", perm: "games.manage" },
      { href: "/admin/gruppen", label: "Gruppen", perm: "groups.manage" },
      { href: "/admin/foren", label: "Foren", perm: "forums.manage" },
      { href: "/admin/events", label: "Veranstaltungen", perm: "events.manage" },
    ],
  },
  {
    group: "Sicherheit",
    items: [
      { href: "/admin/moderation", label: "Moderation", perm: "moderation.handle" },
      { href: "/admin/nachrichten", label: "Nachrichten (Meldungen)", perm: "messages.moderate" },
      { href: "/admin/medien", label: "Medien", perm: "media.moderate" },
      { href: "/admin/anrufe", label: "Anrufe", perm: "calls.manage" },
      { href: "/admin/support", label: "Support", perm: "support.handle" },
    ],
  },
  {
    group: "Inhalte",
    items: [
      { href: "/admin/gold", label: "Gold-CMS", perm: "content.manage" },
      { href: "/admin/seiten", label: "Öffentliche Seiten", perm: "content.manage" },
      { href: "/admin/benachrichtigungen", label: "E-Mail & Benachrichtigungen", perm: "notifications.manage" },
      { href: "/admin/design", label: "Design & Kontakt", perm: "design.manage" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/datenschutz", label: "Datenschutz", perm: "privacy.manage" },
      { href: "/admin/einstellungen", label: "Systemeinstellungen", perm: "settings.manage" },
      { href: "/admin/betrieb", label: "Betrieb & Audit", perm: "ops.view" },
    ],
  },
];
