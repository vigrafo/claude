"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { adminSetSetting } from "@/server/admin/matching";
import { SETTING_SCHEMAS, getSetting, type SettingKey } from "@/server/settings";
import type { PermissionKey } from "@/server/rbac";

/** Welche Bereiche welche Einstellung ändern dürfen (settings.manage darf alle). */
const AREA_KEYS: Partial<Record<PermissionKey, SettingKey[]>> = {
  "matching.manage": ["matching.weights", "ratelimits"],
  "calls.manage": ["calls.limits"],
  "media.moderate": ["uploads.limits"],
  "notifications.manage": ["contact.addresses"],
  "design.manage": ["design", "features"],
};

function num(fd: FormData, k: string): number {
  const v = Number(str(fd, k).replace(",", "."));
  if (!Number.isFinite(v)) throw new AppError("number", `Feld „${k}“ muss eine Zahl sein.`);
  return v;
}

/** Typisiertes Formular: Felder werden anhand des aktuellen Werts (Typ je Feld) gelesen; zod validiert in setSetting. */
async function valueFromForm(key: SettingKey, fd: FormData): Promise<unknown> {
  const current = (await getSetting(key)) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === "boolean") out[k] = bool(fd, `v.${k}`);
    else if (typeof v === "number") out[k] = num(fd, `v.${k}`);
    else if (Array.isArray(v)) out[k] = fd.getAll(`v.${k}`).map(String).filter(Boolean);
    else out[k] = str(fd, `v.${k}`);
  }
  return out;
}

export async function settingFormAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const perm = str(fd, "perm") as PermissionKey;
  const key = str(fd, "key") as SettingKey;
  return adminAct(perm in AREA_KEYS || perm === "settings.manage" ? perm : "settings.manage", async (a) => {
    if (!(key in SETTING_SCHEMAS)) throw new AppError("key", "Unbekannte Einstellung.");
    if (perm !== "settings.manage" && !AREA_KEYS[perm]?.includes(key)) throw new AppError("forbidden", "Keine Berechtigung für diese Einstellung.", 403);
    const value = await valueFromForm(key, fd);
    const row = await adminSetSetting(a.user.id, perm, key, value, str(fd, "reason"));
    return { ok: true, message: `Gespeichert als Version ${row.version}.` };
  });
}

/** JSON-Eingabe (nur Systemeinstellungen) – zod-Fehler werden feldgenau angezeigt. */
export async function settingJsonAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("settings.manage", async (a) => {
    const key = str(fd, "key") as SettingKey;
    if (!(key in SETTING_SCHEMAS)) throw new AppError("key", "Unbekannte Einstellung.");
    let value: unknown;
    try {
      value = JSON.parse(String(fd.get("json") ?? ""));
    } catch {
      throw new AppError("json", "Ungültiges JSON.");
    }
    const row = await adminSetSetting(a.user.id, "settings.manage", key, value, str(fd, "reason"));
    return { ok: true, message: `Gespeichert als Version ${row.version}.` };
  });
}

/** Wartungsmodus umschalten (Design-Bereich) – Teilupdate des features-Objekts. */
export async function maintenanceToggleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("design.manage", async (a) => {
    const f = await getSetting("features");
    const row = await adminSetSetting(a.user.id, "design.manage", "features", { ...f, maintenanceMode: bool(fd, "on") }, str(fd, "reason"));
    return { ok: true, message: `Wartungsmodus ${bool(fd, "on") ? "eingeschaltet" : "ausgeschaltet"} (Version ${row.version}).` };
  });
}
