"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { run, str, type ActionState } from "@/lib/actions";
import { actingUser, testAdaptersEnabled } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { AppError, forbidden, notFound } from "@/server/errors";
import { handleWebhook } from "@/server/payments/service";
import { signTestPayload, TEST_MERCHANT_ID } from "@/server/payments/test-adapter";
import { applyProviderResult } from "@/server/verification";
import { hmac } from "@/server/crypto";

/**
 * NUR ENTWICKLUNG: simuliert signierte Anbieter-Webhooks über denselben Verarbeitungsweg wie echte Anbieter.
 * In Produktion (APP_ENV=production) oder ohne ENABLE_TEST_ADAPTERS=true technisch gesperrt.
 */
function guard() {
  if (!testAdaptersEnabled()) throw notFound();
}

export async function simulatePaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    guard();
    const { userId } = await actingUser();
    const order = await db.order.findUnique({ where: { id: str(fd, "orderId") } });
    if (!order || order.userId !== userId) throw forbidden();
    if (order.provider !== "test") throw new AppError("provider", "Diese Bestellung läuft nicht über den Testadapter.");
    const outcome = str(fd, "outcome") === "fail" ? "payment_failed" : "payment_succeeded";
    const raw = JSON.stringify({
      eventId: `evt_${randomUUID()}`, type: outcome, orderId: order.id, txId: `tx_${randomUUID()}`,
      subscriptionRef: order.kind === "subscription" ? `sub_${order.id}` : undefined,
      amountCents: order.amountCents, currency: order.currency, merchantId: TEST_MERCHANT_ID, timestamp: Date.now(),
    });
    await handleWebhook("test", { rawBody: raw, headers: { "x-test-signature": signTestPayload(raw) }, query: {} });
    redirect(`/app/konto/zahlung?order=${order.id}`);
  });
}

export async function simulateVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    guard();
    const { userId } = await actingUser();
    const c = await db.verificationCase.findUnique({ where: { id: str(fd, "caseId") } });
    if (!c || c.userId !== userId || c.provider !== "test" || !c.providerRef) throw forbidden();
    const r = str(fd, "result");
    const result = r === "verified" ? "verified" : r === "needs_review" ? "needs_review" : "rejected";
    const adult = result !== "rejected";
    const reason = result === "rejected" ? "Simulation: Dokument nicht vollständig lesbar." : undefined;
    const rawBody = JSON.stringify({ provider: "test", providerRef: c.providerRef, result, adult, reason, at: Date.now() });
    const secret = process.env.IDENTITY_WEBHOOK_SECRET ?? "local-identity-secret";
    await applyProviderResult({
      provider: "test", providerRef: c.providerRef, result, adult, reason, signature: hmac(secret, rawBody), rawBody,
    });
    redirect(`/app/verifizierung?case=${c.id}`);
  });
}
