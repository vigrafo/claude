import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { AppError } from "./errors";

/** Typisierte, validierte, versionierte Einstellungen. Kein frei ausführbares HTML/JS/Shell. */
export const SETTING_SCHEMAS = {
  "contact.addresses": z.object({
    admin: z.string().email(), contact: z.string().email(), info: z.string().email(),
  }),
  "calls.limits": z.object({
    maxMinutes: z.number().int().min(1).max(240), maxCallsPerDay: z.number().int().min(1).max(200),
    videoEnabled: z.boolean(), maxBitrateKbps: z.number().int().min(100).max(4000), monthlyBudgetCents: z.number().int().min(0),
  }),
  "uploads.limits": z.object({
    maxImageBytes: z.number().int().min(100_000).max(25_000_000), allowedMime: z.array(z.enum(["image/jpeg", "image/png", "image/webp"])).min(1),
  }),
  "ratelimits": z.object({
    contactRequestsPerDay: z.number().int().min(1).max(500), messagesPerMinute: z.number().int().min(1).max(120),
    registrationsPerHourPerIp: z.number().int().min(1).max(100), contactFormPerHourPerIp: z.number().int().min(1).max(100),
  }),
  "features": z.object({
    registrationOpen: z.boolean(), maintenanceMode: z.boolean(), gamesEnabled: z.boolean(), eventsEnabled: z.boolean(),
    datesEnabled: z.boolean(), giftsEnabled: z.boolean(),
  }),
  "design": z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), tagline: z.string().max(80), maintenanceText: z.string().max(400),
  }),
  "matching.weights": z.object({
    interests: z.number().min(0).max(10), lookingFor: z.number().min(0).max(10), distance: z.number().min(0).max(10),
    activity: z.number().min(0).max(10), verified: z.number().min(0).max(10),
  }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export const SETTING_DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  "contact.addresses": { admin: "verwaltung@eropub.com", contact: "contakt@eropub.com", info: "info@eropub.com" },
  "calls.limits": { maxMinutes: 60, maxCallsPerDay: 20, videoEnabled: true, maxBitrateKbps: 1200, monthlyBudgetCents: 0 },
  "uploads.limits": { maxImageBytes: 8_000_000, allowedMime: ["image/jpeg", "image/png", "image/webp"] },
  ratelimits: { contactRequestsPerDay: 20, messagesPerMinute: 20, registrationsPerHourPerIp: 5, contactFormPerHourPerIp: 5 },
  features: { registrationOpen: true, maintenanceMode: false, gamesEnabled: true, eventsEnabled: true, datesEnabled: true, giftsEnabled: true },
  design: { accent: "#E0263F", tagline: "Echte Menschen. Echte Verbindungen.", maintenanceText: "Wir sind gleich wieder für euch da." },
  "matching.weights": { interests: 3, lookingFor: 4, distance: 2, activity: 1, verified: 2 },
};

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.settingVersion.findFirst({ where: { key }, orderBy: { version: "desc" } });
  if (!row) return SETTING_DEFAULTS[key];
  const parsed = SETTING_SCHEMAS[key].safeParse(row.value);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(key: K, value: unknown, actorUserId: string, reason: string) {
  const parsed = SETTING_SCHEMAS[key].safeParse(value);
  if (!parsed.success) throw new AppError("invalid_setting", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  if (!reason?.trim()) throw new AppError("reason", "Bitte Änderungsgrund angeben.");
  const last = await db.settingVersion.findFirst({ where: { key }, orderBy: { version: "desc" } });
  const row = await db.settingVersion.create({ data: { key, value: parsed.data as object, version: (last?.version ?? 0) + 1, changedBy: actorUserId, reason } });
  await audit("settings.changed", { actorUserId, targetType: "setting", targetId: key, meta: { version: row.version, reason } });
  return row;
}

export async function settingHistory(key: SettingKey) {
  return db.settingVersion.findMany({ where: { key }, orderBy: { version: "desc" }, take: 20 });
}
