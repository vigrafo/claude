import { REAUTH_MINUTES } from "../auth";
import { AppError } from "../errors";
import { requirePermission, type PermissionKey } from "../rbac";

/**
 * Gemeinsame Schutzfunktionen für das Admin-Backend (ohne Next.js-Abhängigkeiten → testbar).
 * Jede Admin-Mutation prüft das Recht zusätzlich serverseitig im Service (Default deny).
 */

/** Optionale IP-Allowlist (ADMIN_ALLOWED_IPS, kommagetrennt). Leer = keine Einschränkung. Exakter Vergleich. */
export function ipAllowed(ip: string, list = process.env.ADMIN_ALLOWED_IPS ?? ""): boolean {
  const allowed = list.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(ip.trim());
}

export function reauthFresh(reauthAt: Date | null | undefined, now = new Date()): boolean {
  if (!reauthAt) return false;
  return now.getTime() - reauthAt.getTime() <= REAUTH_MINUTES * 60_000;
}

/**
 * Sensible Aktionen (Secrets, Exporte, Rollenvergabe, große Tokenkorrekturen) verlangen eine
 * frische Re-Authentifizierung per TOTP innerhalb von REAUTH_MINUTES.
 */
export function requireRecentReauth(admin: { session: { reauthAt: Date | null } }): void {
  if (!reauthFresh(admin.session.reauthAt)) {
    throw new AppError(
      "reauth_required",
      `Bitte bestätige dich erneut mit deinem Code (gültig ${REAUTH_MINUTES} Minuten) – Link „Erneut bestätigen“ oben auf der Seite.`,
      401,
    );
  }
}

export async function assertPerm(userId: string, p: PermissionKey): Promise<void> {
  await requirePermission(userId, p);
}

export function requireReason(reason: string | undefined | null, min = 5): string {
  const r = (reason ?? "").trim();
  if (r.length < min) throw new AppError("reason_required", `Bitte eine Begründung angeben (mind. ${min} Zeichen).`);
  return r.slice(0, 500);
}

/** Klartextprüfung: kein HTML/Skript in redaktionellen Feldern. */
export function assertPlainText(s: string, field = "Text"): string {
  if (/<\s*[a-z!/?]/i.test(s) || /javascript:/i.test(s)) {
    throw new AppError("html_not_allowed", `${field}: Bitte nur Klartext – HTML und Skripte sind nicht erlaubt.`);
  }
  return s;
}

export const PAGE_SIZE = 25;
export function pageArgs(page: number | string | undefined, size = PAGE_SIZE) {
  const p = Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1);
  return { page: p, skip: (p - 1) * size, take: size };
}
