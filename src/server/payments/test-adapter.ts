import { hmac, safeEqual } from "../crypto";
import type { NormalizedEvent, PaymentAdapter, VerifyContext } from "./types";
import { AppError } from "../errors";

/**
 * LOKALER TESTADAPTER – NUR ENTWICKLUNG/TEST.
 * Bestätigt in Produktion niemals Zahlungen: isConfigured() ist false, sobald APP_ENV=production
 * oder ENABLE_TEST_ADAPTERS nicht "true" ist. Webhooks sind HMAC-signiert (wie ein echter Anbieter).
 */
export function testAdapterAllowed(): boolean {
  return process.env.APP_ENV !== "production" && process.env.ENABLE_TEST_ADAPTERS === "true";
}

export function testWebhookSecret(): string {
  return process.env.TEST_PAYMENT_WEBHOOK_SECRET ?? "local-test-webhook-secret";
}

export function signTestPayload(raw: string): string {
  return hmac(testWebhookSecret(), raw);
}

export const testAdapter: PaymentAdapter = {
  key: "test",
  displayName: "Lokaler Testadapter (Simulation)",
  implStatus: "sandbox_only",
  capabilities: ["checkout_hosted", "one_time", "subscription", "cancel", "refund", "status", "chargeback_events", "webhook_signature", "price_change"],
  notes: "Nur für Entwicklung. In Produktion technisch gesperrt.",
  isConfigured: testAdapterAllowed,
  async createCheckout(req) {
    if (!testAdapterAllowed()) throw new AppError("adapter_disabled", "Testadapter ist deaktiviert.", 503);
    return { redirectUrl: `/checkout/test?order=${encodeURIComponent(req.orderId)}`, providerRef: `test_${req.orderId}` };
  },
  async verifyAndParse(ctx: VerifyContext): Promise<NormalizedEvent> {
    if (!testAdapterAllowed()) throw new AppError("adapter_disabled", "Testadapter ist deaktiviert.", 503);
    const sig = ctx.headers["x-test-signature"] ?? "";
    if (!safeEqual(sig, signTestPayload(ctx.rawBody))) throw new AppError("bad_signature", "Signatur ungültig.", 401);
    const j = JSON.parse(ctx.rawBody) as Record<string, unknown>;
    const ts = Number(j.timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60_000) throw new AppError("stale", "Zeitstempel ungültig (Replay-Schutz).", 401);
    return {
      eventId: String(j.eventId),
      type: j.type as NormalizedEvent["type"],
      orderId: j.orderId ? String(j.orderId) : undefined,
      providerTxId: j.txId ? String(j.txId) : undefined,
      subscriptionRef: j.subscriptionRef ? String(j.subscriptionRef) : undefined,
      amountCents: j.amountCents != null ? Number(j.amountCents) : undefined,
      currency: j.currency ? String(j.currency) : undefined,
      merchantId: j.merchantId ? String(j.merchantId) : undefined,
      occurredAt: new Date(ts),
    };
  },
  async cancelSubscription() {},
  async refund() {},
};

export const TEST_MERCHANT_ID = "test-merchant";
