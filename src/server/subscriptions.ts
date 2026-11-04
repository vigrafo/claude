import { db, type Tx } from "./db";
import { AppError } from "./errors";
import { addMonthsUtc, firstRegularChargeDate, introPriceEndsAt, priceForPeriod, type PlanKey } from "@/domain/plans";
import { audit } from "./audit";
import { personState, refreshBadgesForUser } from "./state";
import { personIdentityVerified } from "@/domain/access";
import { createOrder } from "./payments/service";

/**
 * Abos je Person. Identitätsprüfung ist zwingende Voraussetzung – Zahlung, Admin-Tarifwechsel
 * oder Testflags überspringen sie nicht.
 */
export async function startSubscriptionCheckout(userId: string, plan: Exclude<PlanKey, "basis">, provider: string) {
  const person = await personState(userId);
  if (!person || !personIdentityVerified(person)) {
    throw new AppError("verification_required", "Premium und Gold setzen eine abgeschlossene Identitätsprüfung voraus.", 403);
  }
  const open = await db.subscription.findFirst({ where: { userId, status: { in: ["active", "past_due", "pending", "cancel_at_period_end"] } } });
  if (open && open.plan === plan && open.status !== "pending") throw new AppError("exists", "Du hast diesen Tarif bereits.");
  const pv = await currentPlanVersion(plan);
  const clock = await db.premiumClock.findUnique({ where: { userId } });
  const now = new Date();
  const amount = priceForPeriod(plan, now, clock?.introPriceEndsAt ?? null);
  const nextAmount = priceForPeriod(plan, addMonthsUtc(now, 1), clock?.introPriceEndsAt ?? introPriceEndsAt(now));
  return createOrder({
    userId, kind: "subscription", refKey: `${plan}:${pv.id}`, amountCents: amount, currency: "EUR", provider,
    description: `eropub Mitgliedschaft`, recurring: { periodDays: 30, recurringAmountCents: nextAmount },
  });
}

export async function currentPlanVersion(plan: PlanKey, tx: Tx = db) {
  const now = new Date();
  const pv = await tx.planVersion.findFirst({
    where: { plan, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
    orderBy: { version: "desc" },
  });
  if (!pv) throw new AppError("plan_missing", "Keine gültige Preisversion.", 500);
  return pv;
}

/** Erstaktivierung setzt die unveränderliche 24-Monats-Frist (auch bei Gold). */
export async function ensurePremiumClock(tx: Tx, userId: string, at: Date, source: "premium" | "gold") {
  const existing = await tx.premiumClock.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.premiumClock.create({
    data: { userId, firstPremiumActivatedAt: at, introPriceEndsAt: introPriceEndsAt(at), source },
  });
}

export async function activatePlanFromOrder(tx: Tx, orderId: string, providerSubId: string | undefined, at: Date, renewal: boolean) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const [plan, planVersionId] = order.refKey.split(":") as [PlanKey, string];
  const person = await personState(order.userId, tx);
  if (!person || !personIdentityVerified(person)) {
    // Zahlung eingegangen, aber Voraussetzung fehlt → keine Freischaltung, Fall für Support/Erstattung
    await audit("subscription.blocked_unverified", { targetType: "order", targetId: orderId }, tx);
    return;
  }
  const clock = await ensurePremiumClock(tx, order.userId, at, plan === "gold" ? "gold" : "premium");
  let sub = providerSubId
    ? await tx.subscription.findUnique({ where: { provider_providerSubId: { provider: order.provider, providerSubId } } })
    : null;
  const periodStart = renewal && sub?.currentPeriodEnd ? sub.currentPeriodEnd : at;
  const periodEnd = addMonthsUtc(periodStart, 1);
  const nextPrice = priceForPeriod(plan, periodEnd, clock.introPriceEndsAt);
  if (!sub) {
    // Upgrade: bisheriges Abo endet ohne Doppelbelastung (anteilige Verrechnung beim Anbieter)
    const others = await tx.subscription.findMany({ where: { userId: order.userId, status: { in: ["active", "past_due", "cancel_at_period_end"] } } });
    for (const o of others) {
      await tx.subscription.update({ where: { id: o.id }, data: { status: "canceled", canceledAt: at } });
      await tx.entitlement.updateMany({ where: { source: `subscription:${o.id}`, revokedAt: null }, data: { validTo: at } });
    }
    sub = await tx.subscription.create({
      data: {
        userId: order.userId, plan, planVersionId, provider: order.provider, providerSubId: providerSubId ?? `order:${order.id}`,
        status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, nextPriceCents: nextPrice,
      },
    });
  } else {
    sub = await tx.subscription.update({
      where: { id: sub.id },
      data: { status: sub.status === "cancel_at_period_end" ? sub.status : "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, nextPriceCents: nextPrice },
    });
  }
  // Entitlement bis Periodenende + 3 Tage Kulanz für Zahlungslauf
  await tx.entitlement.create({
    data: { userId: order.userId, key: `plan:${plan}`, source: `subscription:${sub.id}`, validFrom: periodStart, validTo: new Date(periodEnd.getTime() + 3 * 86400_000) },
  });
  await refreshBadgesForUser(order.userId, tx);
  await audit("subscription.activated", { targetType: "subscription", targetId: sub.id, meta: { plan, renewal } }, tx);
}

export async function deactivateSubscription(tx: Tx, provider: string, providerSubId: string | undefined, reason: string) {
  if (!providerSubId) return;
  const sub = await tx.subscription.findUnique({ where: { provider_providerSubId: { provider, providerSubId } } });
  if (!sub) return;
  const now = new Date();
  const immediate = reason === "chargeback" || reason === "refund";
  await tx.subscription.update({ where: { id: sub.id }, data: { status: immediate ? "canceled" : "cancel_at_period_end", canceledAt: now } });
  if (immediate) {
    await tx.entitlement.updateMany({ where: { source: `subscription:${sub.id}`, revokedAt: null }, data: { revokedAt: now } });
  } else if (sub.currentPeriodEnd) {
    await tx.entitlement.updateMany({ where: { source: `subscription:${sub.id}`, revokedAt: null }, data: { validTo: sub.currentPeriodEnd } });
  }
  await audit("subscription.deactivated", { targetType: "subscription", targetId: sub.id, meta: { reason } }, tx);
}

/** Kündigung durch Mitglied: zum Periodenende, Anbieter wird informiert. */
export async function cancelOwnSubscription(userId: string, subscriptionId: string) {
  const sub = await db.subscription.findFirst({ where: { id: subscriptionId, userId } });
  if (!sub) throw new AppError("not_found", "Abo nicht gefunden.", 404);
  await db.$transaction((tx) => deactivateSubscription(tx, sub.provider, sub.providerSubId ?? undefined, "member_cancel"));
}

/** Für Konto/Checkout: genaues Datum des ersten höheren Betrags. */
export async function priceOutlook(userId: string) {
  const clock = await db.premiumClock.findUnique({ where: { userId } });
  const sub = await db.subscription.findFirst({ where: { userId, plan: "premium", status: { in: ["active", "cancel_at_period_end"] } } });
  if (!clock) return { introEndsAt: null, firstRegularCharge: null };
  const anchor = sub?.currentPeriodStart ?? clock.firstPremiumActivatedAt;
  return { introEndsAt: clock.introPriceEndsAt, firstRegularCharge: firstRegularChargeDate(anchor, clock.introPriceEndsAt) };
}
