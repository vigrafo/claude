import { createHash } from "node:crypto";
import type { NormalizedEvent, PaymentAdapter, VerifyContext } from "./types";
import { AppError } from "../errors";

/**
 * CCBill-Adapter (Kandidat für Adult-/Dating-Angebote, Merchant-Onboarding erforderlich).
 * Stand: Adapter-/Sandbox-Stand nach öffentlich dokumentierter FlexForms-/Webhook-Schnittstelle.
 * NICHT produktiv freigegeben. Vor Livebetrieb mit aktueller CCBill-Dokumentation und Vertrag abgleichen:
 *  - FlexForms-URL, formDigest-Formel, Währungscode (978 = EUR)
 *  - Webhook-Herkunft (CCBill signiert Webhooks nicht; Prüfung über IP-Allowlist aus Konfiguration
 *    CCBILL_WEBHOOK_IPS + Abgleich per API), Ereignisnamen
 *  - Preiswechsel nach 24 Monaten: von CCBill zu bestätigender Prozess (siehe docs/payments.md)
 */
const env = () => ({
  accnum: process.env.CCBILL_CLIENT_ACCNUM,
  subacc: process.env.CCBILL_CLIENT_SUBACC,
  flexId: process.env.CCBILL_FLEXFORM_ID,
  salt: process.env.CCBILL_SALT,
  ips: (process.env.CCBILL_WEBHOOK_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
});

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export function ccbillFormDigest(p: {
  initialPrice: string; initialPeriod: string; recurringPrice?: string; recurringPeriod?: string; numRebills?: string;
  currencyCode: string; salt: string;
}): string {
  if (p.recurringPrice) {
    return md5(`${p.initialPrice}${p.initialPeriod}${p.recurringPrice}${p.recurringPeriod}${p.numRebills}${p.currencyCode}${p.salt}`);
  }
  return md5(`${p.initialPrice}${p.initialPeriod}${p.currencyCode}${p.salt}`);
}

function ipAllowed(ip: string | undefined, allow: string[]): boolean {
  if (!ip) return false;
  return allow.some((entry) => {
    if (entry.endsWith(".0/24")) return ip.startsWith(entry.replace(".0/24", "."));
    return ip === entry;
  });
}

const EVENT_MAP: Record<string, NormalizedEvent["type"]> = {
  NewSaleSuccess: "payment_succeeded",
  NewSaleFailure: "payment_failed",
  RenewalSuccess: "subscription_renewed",
  RenewalFailure: "payment_failed",
  Cancellation: "subscription_canceled",
  Expiration: "subscription_canceled",
  Refund: "refund",
  Chargeback: "chargeback",
  Void: "refund",
};

export const ccbillAdapter: PaymentAdapter = {
  key: "ccbill",
  displayName: "CCBill",
  implStatus: "sandbox_only",
  capabilities: ["checkout_hosted", "one_time", "subscription", "cancel", "refund", "chargeback_events"],
  notes:
    "Kandidat laut öffentlicher Ausrichtung auf Adult/Dating. Merchant-Onboarding & Vertrag offen. Webhooks unsigniert → IP-Allowlist + API-Abgleich. Preiswechsel nach 24 Monaten mit CCBill zu klären.",
  isConfigured() {
    const e = env();
    return !!(e.accnum && e.subacc && e.flexId && e.salt && e.ips.length);
  },
  async createCheckout(req) {
    const e = env();
    if (!this.isConfigured()) throw new AppError("adapter_unconfigured", "CCBill ist nicht konfiguriert.", 503);
    const currencyCode = req.currency === "EUR" ? "978" : "";
    if (!currencyCode) throw new AppError("currency", "Währung nicht unterstützt.");
    const initialPrice = (req.amountCents / 100).toFixed(2);
    const params: Record<string, string> = {
      clientAccnum: e.accnum!, clientSubacc: e.subacc!, initialPrice, initialPeriod: req.recurring ? String(req.recurring.periodDays) : "2",
      currencyCode, eropubOrderId: req.orderId,
    };
    if (req.recurring) {
      params.recurringPrice = (req.recurring.recurringAmountCents / 100).toFixed(2);
      params.recurringPeriod = String(req.recurring.periodDays);
      params.numRebills = "99";
    }
    params.formDigest = ccbillFormDigest({ ...params, salt: e.salt! } as Parameters<typeof ccbillFormDigest>[0]);
    const url = `https://api.ccbill.com/wap-frontflex/flexforms/${encodeURIComponent(e.flexId!)}?${new URLSearchParams(params)}`;
    return { redirectUrl: url };
  },
  async verifyAndParse(ctx: VerifyContext): Promise<NormalizedEvent> {
    const e = env();
    if (!ipAllowed(ctx.sourceIp, e.ips)) throw new AppError("bad_origin", "Webhook-Herkunft nicht erlaubt.", 401);
    const f = Object.fromEntries(new URLSearchParams(ctx.rawBody));
    const eventType = ctx.query.eventType ?? "";
    const amount = f.accountingInitialPrice ?? f.billedInitialPrice ?? f.accountingAmount ?? f.amount;
    return {
      eventId: `${eventType}:${f.transactionId ?? f.subscriptionId ?? ""}:${f.timestamp ?? ""}`,
      type: EVENT_MAP[eventType] ?? "unknown",
      orderId: f.X_eropubOrderId ?? f.eropubOrderId,
      providerTxId: f.transactionId,
      subscriptionRef: f.subscriptionId,
      amountCents: amount ? Math.round(Number(amount) * 100) : undefined,
      currency: f.accountingCurrencyCode === "978" || f.billedCurrencyCode === "978" ? "EUR" : f.accountingCurrency,
      merchantId: f.clientAccnum,
      occurredAt: f.timestamp ? new Date(f.timestamp) : new Date(),
    };
  },
};
