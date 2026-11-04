/** Zahlungsanbieter-Adapter. Anbieter ≠ Zahlungsmethode. */

export type Capability =
  | "checkout_hosted" | "one_time" | "subscription" | "cancel" | "refund" | "status" | "chargeback_events"
  | "webhook_signature" | "price_change";

export interface CheckoutRequest {
  orderId: string;
  kind: "subscription" | "tokens" | "ticket";
  amountCents: number;
  currency: string;
  description: string; // neutral, diskret
  recurring?: { periodDays: number; recurringAmountCents: number };
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  redirectUrl: string;
  providerRef?: string;
}

/** Normalisiertes Webhook-Ereignis – NACH erfolgreicher Signatur-/Herkunftsprüfung. */
export interface NormalizedEvent {
  eventId: string;
  type: "payment_succeeded" | "payment_failed" | "subscription_renewed" | "subscription_canceled" | "refund" | "chargeback" | "unknown";
  orderId?: string;
  providerRef?: string;
  providerTxId?: string;
  subscriptionRef?: string;
  amountCents?: number;
  currency?: string;
  merchantId?: string;
  occurredAt: Date;
}

export interface VerifyContext {
  rawBody: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  sourceIp?: string;
}

export interface PaymentAdapter {
  key: string;
  displayName: string;
  implStatus: "implemented" | "not_implemented" | "sandbox_only";
  capabilities: Capability[];
  /** Wahrheitsgemäße Hinweise zur Freigabe/Eignung. */
  notes: string;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Prüft Signatur/Herkunft; wirft bei Ungültigkeit. */
  verifyAndParse(ctx: VerifyContext): Promise<NormalizedEvent>;
  cancelSubscription?(subscriptionRef: string): Promise<void>;
  refund?(providerTxId: string, amountCents: number): Promise<void>;
}
