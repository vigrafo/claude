import "server-only";
import { db } from "@/server/db";
import { requireProfile, requireViewer } from "@/lib/viewer";
import { adapterFor } from "@/server/payments/catalog";

/** Aktives Profil der angemeldeten Person – Profil-IDs werden NIE aus Formularen übernommen. */
export async function actingProfile() {
  const v = await requireProfile();
  // grobe Aktivität (für „aktiv in den letzten 7 Tagen“), höchstens alle 15 Minuten geschrieben
  const last = v.profileRow.lastActiveAt?.getTime() ?? 0;
  if (Date.now() - last > 15 * 60_000) {
    await db.communityProfile.update({ where: { id: v.profileRow.id }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
  }
  return { v, userId: v.user.id, profileId: v.profileRow.id };
}

export async function actingUser() {
  const v = await requireViewer();
  return { v, userId: v.user.id };
}

/** Erster freigegebener, technisch konfigurierter Zahlungsanbieter (höchste Priorität). */
export async function enabledPaymentProvider(): Promise<{ key: string; displayName: string } | null> {
  const rows = await db.providerConfiguration.findMany({ where: { enabled: true }, orderBy: { priority: "desc" } });
  for (const r of rows) {
    const a = adapterFor(r.key);
    if (a && a.isConfigured()) return { key: r.key, displayName: r.displayName };
  }
  return null;
}

export function testAdaptersEnabled(): boolean {
  return process.env.APP_ENV !== "production" && process.env.ENABLE_TEST_ADAPTERS === "true";
}
