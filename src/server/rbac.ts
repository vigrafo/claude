import { db } from "./db";
import { forbidden } from "./errors";

/**
 * Rollen & Rechte. Default deny. Plattformadmins erhalten NICHT automatisch Zugriff auf
 * Ausweisbelege oder private Nachrichten (eigene Rechte: verification.evidence, moderation.evidence).
 */
export const PERMISSIONS = {
  "admin.access": "Adminbereich betreten",
  "dashboard.view": "Dashboard ansehen",
  "users.read": "Personen & Profile ansehen",
  "users.manage": "Personen sperren/entsperren, Paarzuordnung",
  "users.export": "Datenexporte erstellen",
  "verification.review": "Verifizierungen prüfen",
  "verification.evidence": "Temporäre Verifizierungsbelege ansehen",
  "roles.manage": "Rollen vergeben",
  "plans.manage": "Tarife & Preisversionen",
  "tokens.manage": "Tokenpakete & Korrekturen",
  "providers.manage": "Zahlungsanbieter & Secrets",
  "finance.read": "Finanzvorgänge ansehen",
  "finance.manage": "Erstattungen & Abgleich",
  "matching.manage": "Interessen & Matching-Regeln",
  "games.manage": "Spiele & Fragenkatalog",
  "messages.moderate": "Gemeldete Nachrichten (fallbezogen)",
  "calls.manage": "Anrufeinstellungen",
  "media.moderate": "Medienmoderation",
  "groups.manage": "Gruppen freigeben & verwalten",
  "forums.manage": "Foren verwalten",
  "events.manage": "Events, Veranstalter & Clubs",
  "discounts.manage": "Gold-Rabatte",
  "content.manage": "Gold-CMS & öffentliche Seiten",
  "moderation.handle": "Moderationsfälle",
  "moderation.evidence": "Belege gemeldeter Inhalte einsehen",
  "support.handle": "Supporttickets",
  "notifications.manage": "E-Mail & Vorlagen",
  "privacy.manage": "Datenschutz, Löschläufe, Einwilligungen",
  "design.manage": "Design & Kontaktangaben",
  "settings.manage": "Systemeinstellungen & Feature-Flags",
  "ops.view": "Betrieb & Audit",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLES: Record<string, { name: string; permissions: PermissionKey[]; critical?: boolean }> = {
  superadmin: { name: "Superadmin", permissions: ALL.filter((p) => p !== "verification.evidence" && p !== "moderation.evidence"), critical: true },
  platform_admin: {
    name: "Plattformadmin",
    critical: true,
    permissions: [
      "admin.access", "dashboard.view", "users.read", "users.manage", "plans.manage", "tokens.manage", "matching.manage",
      "games.manage", "calls.manage", "groups.manage", "forums.manage", "events.manage", "discounts.manage",
      "notifications.manage", "design.manage", "settings.manage", "ops.view", "privacy.manage",
    ],
  },
  verifier: { name: "Verifizierungsprüfer", permissions: ["admin.access", "dashboard.view", "verification.review", "verification.evidence", "users.read"] },
  moderator: {
    name: "Moderation",
    permissions: ["admin.access", "dashboard.view", "moderation.handle", "moderation.evidence", "messages.moderate", "media.moderate", "forums.manage", "users.read"],
  },
  support: { name: "Support", permissions: ["admin.access", "dashboard.view", "support.handle", "users.read"] },
  finance: { name: "Finanzen", permissions: ["admin.access", "dashboard.view", "finance.read", "finance.manage", "tokens.manage", "providers.manage"], critical: true },
  editor: { name: "Redaktion", permissions: ["admin.access", "dashboard.view", "content.manage", "forums.manage"] },
  organizer: { name: "Veranstalter", permissions: [] }, // Rechte nur über eigene Events (Scope)
  group_moderator: { name: "Gruppenmoderator", permissions: [] }, // nur Scope "group" – kein Adminzugang
};

export async function permissionsOf(userId: string): Promise<Set<PermissionKey>> {
  const assignments = await db.roleAssignment.findMany({
    where: { userId, revokedAt: null, scopeType: null },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  const set = new Set<PermissionKey>();
  for (const a of assignments) for (const rp of a.role.permissions) set.add(rp.permission.key as PermissionKey);
  return set;
}

export async function hasPermission(userId: string, p: PermissionKey): Promise<boolean> {
  return (await permissionsOf(userId)).has(p);
}

export async function requirePermission(userId: string, p: PermissionKey): Promise<void> {
  if (!(await hasPermission(userId, p))) throw forbidden();
}

export async function isGroupModerator(userId: string, groupId: string): Promise<boolean> {
  const r = await db.roleAssignment.findFirst({
    where: { userId, revokedAt: null, scopeType: "group", scopeId: groupId, role: { key: "group_moderator" } },
  });
  return !!r;
}

/** Synchronisiert Rollen/Rechte-Tabellen mit der Code-Definition (idempotent). */
export async function syncRbac(): Promise<void> {
  for (const [key, label] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, update: { label }, create: { key, label } });
  }
  for (const [key, def] of Object.entries(ROLES)) {
    const role = await db.role.upsert({ where: { key }, update: { name: def.name }, create: { key, name: def.name } });
    const perms = await db.permission.findMany({ where: { key: { in: def.permissions } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length) await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
}
