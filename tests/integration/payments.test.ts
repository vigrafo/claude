import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createTokenOrder, handleWebhook } from "@/server/payments/service";
import { signTestPayload, TEST_MERCHANT_ID } from "@/server/payments/test-adapter";
import { startSubscriptionCheckout } from "@/server/subscriptions";
import { activePlan } from "@/server/state";
import { ledgerBalance } from "@/server/tokens";
import { canEnable, PROVIDER_CATALOG } from "@/server/payments/catalog";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

let n = 0;
function hook(p: Record<string, unknown>, opts: { badSig?: boolean; ts?: number } = {}) {
  const raw = JSON.stringify({ eventId: `ev_${++n}_${Math.random()}`, merchantId: TEST_MERCHANT_ID, currency: "EUR", timestamp: opts.ts ?? Date.now(), ...p });
  return handleWebhook("test", { rawBody: raw, headers: { "x-test-signature": opts.badSig ? "00" : signTestPayload(raw) }, query: {} });
}

describe("Zahlungen & Webhooks", () => {
  it("Tokens nur nach bestätigtem Webhook; doppelte/verspätete Webhooks schreiben nicht doppelt gut", async () => {
    const u = await makeUser({ verified: false });
    const p = await makeProfile("single", [u]);
    const { order } = await createTokenOrder(u.id, p.id, "t20", "test");
    expect(await ledgerBalance(p.id)).toBe(0); // Rückleitung allein bewirkt nichts
    const ev = { eventId: `fixed_${order.id}`, type: "payment_succeeded", orderId: order.id, amountCents: 500, txId: `tx_${order.id}` };
    await expect(hook(ev)).resolves.toMatchObject({ status: "fulfilled" });
    await expect(hook(ev)).resolves.toMatchObject({ status: "duplicate" });
    await expect(hook({ ...ev, eventId: "other" })).resolves.toMatchObject({ status: "duplicate_tx" });
    expect(await ledgerBalance(p.id)).toBe(20);
    expect(await db.invoice.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("ungültige Signatur, alter Zeitstempel, falscher Betrag/Währung/Merchant/Order → keine Leistung", async () => {
    const u = await makeUser({ verified: false });
    const p = await makeProfile("single", [u]);
    const { order } = await createTokenOrder(u.id, p.id, "t40", "test");
    const base = { type: "payment_succeeded", orderId: order.id, amountCents: 1000 };
    await expect(hook(base, { badSig: true })).rejects.toMatchObject({ code: "bad_signature" });
    await expect(hook(base, { ts: Date.now() - 3600_000 })).rejects.toMatchObject({ code: "stale" });
    await expect(hook({ ...base, amountCents: 1 })).resolves.toMatchObject({ status: "rejected" });
    await expect(hook({ ...base, currency: "USD" })).resolves.toMatchObject({ status: "rejected" });
    await expect(hook({ ...base, merchantId: "evil" })).resolves.toMatchObject({ status: "rejected" });
    await expect(hook({ ...base, orderId: "nope" })).resolves.toMatchObject({ status: "rejected" });
    expect(await ledgerBalance(p.id)).toBe(0);
  });

  it("vertauschte Reihenfolge: Chargeback vor Zahlung → keine Freischaltung; Chargeback nach Verbrauch → kein negatives Guthaben", async () => {
    const u = await makeUser({ verified: false });
    const p = await makeProfile("single", [u]);
    const o1 = (await createTokenOrder(u.id, p.id, "t20", "test")).order;
    await hook({ type: "chargeback", orderId: o1.id, amountCents: 500 });
    await expect(hook({ type: "payment_succeeded", orderId: o1.id, amountCents: 500, txId: "a1" })).resolves.toMatchObject({ status: "rejected" });
    expect(await ledgerBalance(p.id)).toBe(0);

    const o2 = (await createTokenOrder(u.id, p.id, "t20", "test")).order;
    await hook({ type: "payment_succeeded", orderId: o2.id, amountCents: 500, txId: "a2" });
    // 15 Tokens verbraucht
    await db.$transaction(async (tx) => {
      const { postLedger } = await import("@/server/tokens");
      await postLedger(tx, { profileId: p.id, delta: -15, kind: "message", idemKey: `use:${p.id}` });
    });
    await hook({ type: "chargeback", orderId: o2.id, amountCents: 500 });
    expect(await ledgerBalance(p.id)).toBe(0);
    expect((await db.tokenDebt.findFirstOrThrow({ where: { profileId: p.id } })).tokens).toBe(15);
    await expect(createTokenOrder(u.id, p.id, "t20", "test")).rejects.toMatchObject({ code: "blocked" });
  });

  it("Premium nur mit Identitätsprüfung; Aktivierung setzt 24-Monats-Frist einmalig", async () => {
    const unv = await makeUser({ verified: false });
    await expect(startSubscriptionCheckout(unv.id, "premium", "test")).rejects.toMatchObject({ code: "verification_required" });
    const u = await makeUser();
    const { order } = await startSubscriptionCheckout(u.id, "premium", "test");
    expect(order.amountCents).toBe(700);
    await hook({ type: "payment_succeeded", orderId: order.id, amountCents: 700, txId: `p_${order.id}`, subscriptionRef: `sub_${order.id}` });
    expect(await activePlan(u.id)).toBe("premium");
    const clock = await db.premiumClock.findUniqueOrThrow({ where: { userId: u.id } });
    // Kündigung + Neubuchung setzt Frist nicht zurück
    await hook({ type: "subscription_canceled", orderId: order.id, subscriptionRef: `sub_${order.id}` });
    const again = await startSubscriptionCheckout(u.id, "gold", "test");
    expect(again.order.amountCents).toBe(2500);
    await hook({ type: "payment_succeeded", orderId: again.order.id, amountCents: 2500, txId: `g_${again.order.id}`, subscriptionRef: `sub_${again.order.id}` });
    expect(await activePlan(u.id)).toBe("gold");
    const clock2 = await db.premiumClock.findUniqueOrThrow({ where: { userId: u.id } });
    expect(clock2.introPriceEndsAt.toISOString()).toBe(clock.introPriceEndsAt.toISOString());
  });

  it("Zahlung eines nicht (mehr) verifizierten Kontos schaltet nichts frei", async () => {
    const u = await makeUser();
    const { order } = await startSubscriptionCheckout(u.id, "premium", "test");
    await db.user.update({ where: { id: u.id }, data: { identityStatus: "revoked" } });
    await hook({ type: "payment_succeeded", orderId: order.id, amountCents: 700, txId: `r_${order.id}`, subscriptionRef: `s_${order.id}` });
    expect(await activePlan(u.id)).toBe("basis");
  });

  it("Katalog: nicht implementierte oder ungeeignete Anbieter sind nicht aktivierbar; Test nie live", () => {
    for (const p of PROVIDER_CATALOG.filter((x) => x.implStatus === "not_implemented")) expect(canEnable(p, "sandbox").ok).toBe(false);
    expect(canEnable(PROVIDER_CATALOG.find((p) => p.key === "test")!, "live").ok).toBe(false);
    expect(canEnable(PROVIDER_CATALOG.find((p) => p.key === "ccbill")!, "sandbox").ok).toBe(false); // nicht konfiguriert
  });

  it("Testadapter ist in Produktion gesperrt", async () => {
    const prev = process.env.APP_ENV;
    process.env.APP_ENV = "production";
    try {
      const raw = JSON.stringify({ eventId: "x", type: "payment_succeeded", timestamp: Date.now() });
      await expect(handleWebhook("test", { rawBody: raw, headers: { "x-test-signature": signTestPayload(raw) }, query: {} })).rejects.toMatchObject({ code: "adapter_disabled" });
    } finally {
      process.env.APP_ENV = prev;
    }
  });
});
