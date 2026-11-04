import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { refreshBadgesForUser } from "../state";
import { PLAN_FEATURES, type PlanKey } from "@/domain/plans";
import { assertPerm, requireReason } from "./guard";

/**
 * Preisversionen sind unveränderlich: Änderungen erzeugen eine NEUE Version mit validFrom in der Zukunft.
 * Bestehende Abos behalten ihre planVersionId. Die 24-Monats-Frist (PremiumClock) wird nie verändert.
 */
export async function createPlanVersion(actorUserId: string, input: {
  plan: PlanKey; priceCents: number; introPriceCents?: number | null; introMonths?: number | null; validFrom: Date; currency?: string; taxRateBp?: number;
}) {
  await assertPerm(actorUserId, "plans.manage");
  if (!["basis", "premium", "gold"].includes(input.plan)) throw new AppError("plan", "Unbekannter Tarif.");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 100_000) throw new AppError("price", "Preis in Cent (0–100000) angeben.");
  if (input.introPriceCents != null && (!Number.isInteger(input.introPriceCents) || input.introPriceCents < 0 || input.introPriceCents > input.priceCents)) {
    throw new AppError("intro", "Einführungspreis muss zwischen 0 und dem regulären Preis liegen.");
  }
  if ((input.introPriceCents != null) !== (input.introMonths != null)) throw new AppError("intro", "Einführungspreis und -dauer nur gemeinsam angeben.");
  if (input.introMonths != null && (!Number.isInteger(input.introMonths) || input.introMonths < 1 || input.introMonths > 60)) throw new AppError("intro", "Einführungsdauer 1–60 Monate.");
  if (!(input.validFrom instanceof Date) || Number.isNaN(input.validFrom.getTime()) || input.validFrom.getTime() <= Date.now()) {
    throw new AppError("valid_from", "„Gültig ab“ muss in der Zukunft liegen.");
  }
  const last = await db.planVersion.findFirst({ where: { plan: input.plan }, orderBy: { version: "desc" } });
  const row = await db.planVersion.create({
    data: {
      plan: input.plan, version: (last?.version ?? 0) + 1, priceCents: input.priceCents, introPriceCents: input.introPriceCents ?? null,
      introMonths: input.introMonths ?? null, currency: input.currency ?? last?.currency ?? "EUR", taxRateBp: input.taxRateBp ?? last?.taxRateBp ?? 1900,
      features: (last?.features ?? PLAN_FEATURES[input.plan]) as object, validFrom: input.validFrom, createdById: actorUserId,
    },
  });
  await audit("plan.version_created", { actorUserId, targetType: "plan_version", targetId: row.id, meta: { plan: row.plan, version: row.version, priceCents: row.priceCents } });
  return row;
}

/**
 * Manuelle Entitlement-Korrektur. Premium/Gold NIE ohne abgeschlossene Identitätsprüfung.
 */
export async function grantPlanEntitlement(actorUserId: string, userId: string, plan: "premium" | "gold", validTo: Date | null, reasonRaw: string) {
  await assertPerm(actorUserId, "plans.manage");
  const reason = requireReason(reasonRaw);
  if (plan !== "premium" && plan !== "gold") throw new AppError("plan", "Nur Premium oder Gold.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound();
  if (user.identityStatus !== "verified") {
    throw new AppError("verification_required", "Blockiert: Premium/Gold setzen eine abgeschlossene Identitätsprüfung voraus.", 403);
  }
  if (validTo && validTo.getTime() <= Date.now()) throw new AppError("valid_to", "„Gültig bis“ muss in der Zukunft liegen.");
  const e = await db.entitlement.create({ data: { userId, key: `plan:${plan}`, source: `admin:${actorUserId}`, validFrom: new Date(), validTo } });
  await refreshBadgesForUser(userId);
  await audit("entitlement.granted", { actorUserId, targetType: "user", targetId: userId, meta: { plan, validTo: validTo?.toISOString() ?? null, reason } });
  return e;
}

export async function revokeEntitlement(actorUserId: string, entitlementId: string, reasonRaw: string) {
  await assertPerm(actorUserId, "plans.manage");
  const reason = requireReason(reasonRaw);
  const e = await db.entitlement.findUnique({ where: { id: entitlementId } });
  if (!e || e.revokedAt) throw notFound();
  await db.entitlement.update({ where: { id: e.id }, data: { revokedAt: new Date() } });
  await refreshBadgesForUser(e.userId);
  await audit("entitlement.revoked", { actorUserId, targetType: "user", targetId: e.userId, meta: { key: e.key, source: e.source, reason } });
}
