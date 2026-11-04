import { db, isUniqueViolation, type Tx } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { adapterFor } from "./catalog";
import type { NormalizedEvent, VerifyContext } from "./types";
import { TEST_MERCHANT_ID } from "./test-adapter";
import { postLedger, chargebackTokens } from "../tokens";
import { activatePlanFromOrder, deactivateSubscription } from "../subscriptions";
import { randomToken } from "../crypto";
import { enqueue } from "../outbox";

export function expectedMerchant(provider: string): string | undefined {
  if (provider === "test") return TEST_MERCHANT_ID;
  if (provider === "ccbill") return process.env.CCBILL_CLIENT_ACCNUM;
  return undefined;
}

export async function createTokenOrder(userId: string, profileId: string, packageKey: string, provider: string) {
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw new AppError("forbidden", "Kein Mitglied dieses Profils.", 403);
  const pkg = await db.tokenPackageVersion.findFirst({ where: { key: packageKey, active: true }, orderBy: { version: "desc" } });
  if (!pkg) throw new AppError("not_found", "Paket nicht verfügbar.", 404);
  if (await db.tokenDebt.count({ where: { profileId, settledAt: null } })) {
    throw new AppError("blocked", "Käufe sind wegen einer offenen Rückbuchung vorübergehend gesperrt. Bitte kontaktiere den Support.", 403);
  }
  return createOrder({
    userId, profileId, kind: "tokens", refKey: `${pkg.key}:v${pkg.version}`, amountCents: pkg.priceCents,
    currency: pkg.currency, provider, description: `eropub Guthaben ${pkg.tokens}`,
  });
}

export async function createOrder(o: {
  userId: string; profileId?: string; kind: "subscription" | "tokens" | "ticket"; refKey: string; amountCents: number;
  currency: string; provider: string; description: string; recurring?: { periodDays: number; recurringAmountCents: number };
}) {
  const adapter = adapterFor(o.provider);
  if (!adapter || !adapter.isConfigured()) throw new AppError("provider_unavailable", "Zahlungsanbieter nicht verfügbar.", 503);
  const cfg = await db.providerConfiguration.findUnique({ where: { key: o.provider } });
  if (!cfg?.enabled) throw new AppError("provider_disabled", "Zahlungsanbieter ist nicht aktiviert.", 503);
  const order = await db.order.create({
    data: {
      userId: o.userId, profileId: o.profileId, kind: o.kind, refKey: o.refKey, amountCents: o.amountCents,
      currency: o.currency, provider: o.provider, idemKey: randomToken(16), status: "pending",
    },
  });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const session = await adapter.createCheckout({
    orderId: order.id, kind: o.kind, amountCents: o.amountCents, currency: o.currency, description: o.description,
    recurring: o.recurring, returnUrl: `${base}/konto/zahlung?order=${order.id}`, cancelUrl: `${base}/preise`,
  });
  if (session.providerRef) await db.order.update({ where: { id: order.id }, data: { providerRef: session.providerRef } });
  return { order, redirectUrl: session.redirectUrl };
}

/**
 * Webhook-Verarbeitung: Signatur/Herkunft → Speicherung (eindeutig je provider+eventId, Replay-Schutz)
 * → fachliche Prüfung (Order, Betrag, Währung, Merchant) → idempotente Erfüllung.
 * Browser-Rückleitungen lösen NIE eine Erfüllung aus.
 */
export async function handleWebhook(provider: string, ctx: VerifyContext): Promise<{ status: string; reason?: string }> {
  const adapter = adapterFor(provider);
  if (!adapter) throw new AppError("unknown_provider", "Unbekannter Anbieter.", 404);
  let ev: NormalizedEvent;
  try {
    ev = await adapter.verifyAndParse(ctx);
  } catch (e) {
    await db.webhookEvent.create({
      data: { provider, eventId: `invalid:${randomToken(8)}`, type: "invalid", signatureOk: false, payload: {}, status: "rejected", error: (e as Error).message },
    });
    throw e;
  }

  let row;
  try {
    row = await db.webhookEvent.create({
      data: { provider, eventId: ev.eventId, type: ev.type, signatureOk: true, payload: JSON.parse(JSON.stringify(ev)) },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate" };
    throw e;
  }
  await db.providerConfiguration.updateMany({ where: { key: provider }, data: { webhookLastAt: new Date(), webhookHealthy: true } });

  try {
    const result = await db.$transaction((tx) => applyEvent(tx, provider, ev), { timeout: 20000 });
    await db.webhookEvent.update({
      where: { id: row.id },
      data: { status: result.status === "rejected" ? "rejected" : "processed", error: result.reason, processedAt: new Date(), attempts: 1 },
    });
    return result;
  } catch (e) {
    await db.webhookEvent.update({ where: { id: row.id }, data: { status: "failed", error: (e as Error).message.slice(0, 500), attempts: 1 } });
    throw e;
  }
}

async function applyEvent(tx: Tx, provider: string, ev: NormalizedEvent): Promise<{ status: string; reason?: string }> {
  if (!ev.orderId) return { status: "rejected", reason: "Keine Order-ID." };
  // Order sperren (serialisiert parallele/verspätete Ereignisse derselben Order)
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${ev.orderId} FOR UPDATE`;
  if (!locked.length) return { status: "rejected", reason: "Unbekannte Order." };
  const order = await tx.order.findUniqueOrThrow({ where: { id: ev.orderId } });
  if (order.provider !== provider) return { status: "rejected", reason: "Anbieter passt nicht zur Order." };
  if (ev.merchantId !== expectedMerchant(provider)) return { status: "rejected", reason: "Merchant-ID passt nicht." };

  switch (ev.type) {
    case "payment_succeeded":
    case "subscription_renewed": {
      if (ev.currency !== order.currency) return { status: "rejected", reason: "Währung passt nicht." };
      if (ev.amountCents !== order.amountCents && ev.type === "payment_succeeded") return { status: "rejected", reason: "Betrag passt nicht." };
      if (["refunded", "chargeback", "canceled"].includes(order.status) && ev.type === "payment_succeeded") {
        // vertauschte Reihenfolge: Erstattung/Chargeback kam zuerst → keine Freischaltung
        return { status: "rejected", reason: `Order bereits ${order.status}.` };
      }
      if (ev.providerTxId) {
        const dup = await tx.payment.findUnique({ where: { provider_providerTxId: { provider, providerTxId: ev.providerTxId } } });
        if (dup) return { status: "duplicate_tx" };
        await tx.payment.create({
          data: { orderId: order.id, provider, providerTxId: ev.providerTxId, amountCents: ev.amountCents ?? 0, currency: ev.currency ?? "", status: "succeeded" },
        });
      }
      if (ev.type === "payment_succeeded") {
        if (order.status === "paid") return { status: "already_paid" };
        await tx.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: ev.occurredAt } });
        await fulfil(tx, order.id, ev);
      } else {
        await activatePlanFromOrder(tx, order.id, ev.subscriptionRef, ev.occurredAt, true);
      }
      await issueInvoice(tx, order.id, ev.amountCents ?? order.amountCents);
      return { status: "fulfilled" };
    }
    case "payment_failed": {
      if (order.status === "pending" || order.status === "created") {
        await tx.order.update({ where: { id: order.id }, data: { status: "failed" } });
      } else if (order.kind === "subscription") {
        await tx.subscription.updateMany({ where: { provider, providerSubId: ev.subscriptionRef ?? "" }, data: { status: "past_due" } });
      }
      return { status: "recorded" };
    }
    case "subscription_canceled": {
      await deactivateSubscription(tx, provider, ev.subscriptionRef, "provider_cancel");
      return { status: "recorded" };
    }
    case "refund":
    case "chargeback": {
      const kind = ev.type;
      if (order.status === "refunded" || order.status === "chargeback") return { status: "already_reversed" };
      await tx.refund.create({
        data: { orderId: order.id, amountCents: ev.amountCents ?? order.amountCents, reason: kind, kind, providerRef: ev.providerTxId },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: kind === "refund" ? "refunded" : "chargeback" } });
      if (order.fulfilledAt && order.kind === "tokens" && order.profileId) {
        const tokens = Number(order.refKey.split(":")[0].replace(/^t/, "")) || 0;
        await chargebackTokens(tx, order.profileId, tokens, order.id);
      }
      if (order.kind === "subscription") await deactivateSubscription(tx, provider, ev.subscriptionRef, kind);
      if (order.kind === "ticket") {
        await tx.ticketOrder.updateMany({ where: { id: order.refKey }, data: { status: "refunded" } });
        await tx.discountRedemption.updateMany({ where: { ticketOrderId: order.refKey }, data: { status: "released", activeKey: null } });
      }
      await audit(`payment.${kind}`, { targetType: "order", targetId: order.id }, tx);
      return { status: "reversed" };
    }
    default:
      return { status: "ignored" };
  }
}

async function fulfil(tx: Tx, orderId: string, ev: NormalizedEvent) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.fulfilledAt) return;
  if (order.kind === "tokens") {
    const [key, ver] = order.refKey.split(":v");
    const pkg = await tx.tokenPackageVersion.findUniqueOrThrow({ where: { key_version: { key, version: Number(ver) } } });
    await postLedger(tx, {
      profileId: order.profileId!, delta: pkg.tokens, kind: "purchase", idemKey: `purchase:${order.id}`, refType: "order", refId: order.id,
    });
  } else if (order.kind === "subscription") {
    await activatePlanFromOrder(tx, order.id, ev.subscriptionRef, ev.occurredAt, false);
  } else if (order.kind === "ticket") {
    await tx.ticketOrder.updateMany({ where: { id: order.refKey, status: "reserved" }, data: { status: "paid", paidAt: new Date() } });
    await tx.discountRedemption.updateMany({ where: { ticketOrderId: order.refKey, status: "reserved" }, data: { status: "redeemed" } });
  }
  await tx.order.update({ where: { id: order.id }, data: { fulfilledAt: new Date() } });
  await enqueue(tx, "notify.user", { userId: order.userId, kind: "payment", title: "Zahlung bestätigt", link: "/konto" });
}

async function issueInvoice(tx: Tx, orderId: string, grossCents: number) {
  const existing = await tx.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  const taxBp = 1900;
  const net = Math.round((grossCents * 10_000) / (10_000 + taxBp));
  const count = await tx.invoice.count();
  return tx.invoice.create({
    data: {
      orderId, number: `EP-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`,
      grossCents, netCents: net, taxCents: grossCents - net, currency: "EUR",
    },
  });
}
