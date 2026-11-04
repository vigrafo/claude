import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { encrypt, maskSecret } from "../crypto";
import { canEnable, PROVIDER_CATALOG, type CatalogEntry } from "../payments/catalog";
import { assertPerm } from "./guard";

/**
 * Zahlungsanbieter. Aktivierung nur, wenn canEnable(entry, mode).ok – Status kommt aus dem Code-Katalog,
 * nicht aus der Datenbank (keine Selbstzertifizierung per UI). Secrets nur verschlüsselt, nie im Klartext angezeigt.
 */
export function catalogEntry(key: string): CatalogEntry {
  const e = PROVIDER_CATALOG.find((p) => p.key === key);
  if (!e) throw notFound("Anbieter nicht im Katalog.");
  return e;
}

export function enableCheck(key: string, mode: string) {
  return canEnable(catalogEntry(key), mode === "live" ? "live" : "sandbox");
}

export async function setProviderEnabled(actorUserId: string, key: string, enabled: boolean) {
  await assertPerm(actorUserId, "providers.manage");
  const cfg = await db.providerConfiguration.findUnique({ where: { key } });
  if (!cfg) throw notFound();
  if (enabled) {
    const chk = enableCheck(key, cfg.mode);
    if (!chk.ok) throw new AppError("cannot_enable", `Aktivierung nicht möglich: ${chk.reason}`);
  }
  await db.providerConfiguration.update({ where: { key }, data: { enabled } });
  await audit(enabled ? "provider.enabled" : "provider.disabled", { actorUserId, targetType: "provider", targetId: key, meta: { mode: cfg.mode } });
}

export async function setProviderMode(actorUserId: string, key: string, mode: "sandbox" | "live") {
  await assertPerm(actorUserId, "providers.manage");
  const cfg = await db.providerConfiguration.findUnique({ where: { key } });
  if (!cfg) throw notFound();
  const entry = catalogEntry(key);
  if (mode === "live") {
    if (entry.implStatus !== "implemented") throw new AppError("live_blocked", "Livebetrieb gesperrt: Adapter ist nur Sandbox-Stand bzw. nicht implementiert.");
    if (process.env.APP_ENV === "production" && key === "test") throw new AppError("live_blocked", "Testadapter nie im Livebetrieb.");
    const chk = canEnable(entry, "live");
    if (!chk.ok) throw new AppError("live_blocked", `Livebetrieb nicht möglich: ${chk.reason}`);
  }
  // Moduswechsel deaktiviert vorsorglich – Aktivierung danach bewusst erneut prüfen
  await db.providerConfiguration.update({ where: { key }, data: { mode, enabled: mode === cfg.mode ? cfg.enabled : false } });
  await audit("provider.mode_changed", { actorUserId, targetType: "provider", targetId: key, meta: { from: cfg.mode, to: mode } });
}

const CODE = /^[A-Z]{2}$/;
const CUR = /^[A-Z]{3}$/;
const METHOD = /^[a-z0-9_ ()-]{2,40}$/i;

function list(raw: string, re: RegExp, label: string, upper = true): string[] {
  const items = raw.split(/[,\s]+/).map((s) => (upper ? s.trim().toUpperCase() : s.trim())).filter(Boolean);
  for (const i of items) if (!re.test(i)) throw new AppError("invalid", `${label}: „${i}“ ist ungültig.`);
  return [...new Set(items)];
}

export async function updateProviderSettings(actorUserId: string, key: string, input: { priority: number; countries: string; currencies: string; methods: string }) {
  await assertPerm(actorUserId, "providers.manage");
  const cfg = await db.providerConfiguration.findUnique({ where: { key } });
  if (!cfg) throw notFound();
  if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 9999) throw new AppError("priority", "Priorität 0–9999.");
  const countries = list(input.countries, CODE, "Länder");
  const currencies = list(input.currencies, CUR, "Währungen");
  if (!currencies.length) throw new AppError("currencies", "Mindestens eine Währung angeben.");
  const methods = input.methods.split(",").map((s) => s.trim()).filter(Boolean);
  for (const m of methods) if (!METHOD.test(m)) throw new AppError("methods", `Methode „${m}“ ist ungültig.`);
  await db.providerConfiguration.update({ where: { key }, data: { priority: input.priority, countries, currencies, methods } });
  await audit("provider.settings_changed", { actorUserId, targetType: "provider", targetId: key, meta: { priority: input.priority, countries, currencies, methods } });
}

/** Secret wird ausschließlich verschlüsselt gespeichert; angezeigt wird nur der Hinweis „••••abcd“. */
export async function setProviderSecret(actorUserId: string, key: string, secretPlain: string) {
  await assertPerm(actorUserId, "providers.manage");
  const cfg = await db.providerConfiguration.findUnique({ where: { key } });
  if (!cfg) throw notFound();
  const s = secretPlain.trim();
  if (s.length < 8 || s.length > 500) throw new AppError("secret", "Secret: 8–500 Zeichen.");
  await db.providerConfiguration.update({ where: { key }, data: { secretRef: encrypt(s), secretHint: maskSecret(s) } });
  await audit("provider.secret_set", { actorUserId, targetType: "provider", targetId: key });
}

export async function clearProviderSecret(actorUserId: string, key: string) {
  await assertPerm(actorUserId, "providers.manage");
  await db.providerConfiguration.update({ where: { key }, data: { secretRef: null, secretHint: null, enabled: false } });
  await audit("provider.secret_cleared", { actorUserId, targetType: "provider", targetId: key });
}
