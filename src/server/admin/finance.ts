import { db, type Prisma } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { postLedger } from "../tokens";
import { activatePlanFromOrder } from "../subscriptions";
import { enqueue } from "../outbox";
import { issueInvoice } from "../payments/service";
import { assertPerm, requireReason } from "./guard";

export interface OrderFilter { q?: string; status?: string; kind?: string; provider?: string; from?: Date; to?: Date }

export function orderWhere(f: OrderFilter): Prisma.OrderWhereInput {
  const w: Prisma.OrderWhereInput = {};
  if (f.status) w.status = f.status;
  if (f.kind) w.kind = f.kind;
  if (f.provider) w.provider = f.provider;
  if (f.from || f.to) w.createdAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) };
  if (f.q) w.OR = [{ id: f.q }, { providerRef: f.q }, { invoice: { number: f.q } }];
  return w;
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // CSV-/Formel-Injection verhindern
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV-Export der Bestellungen (keine Kartendaten vorhanden, keine E-Mail-Adressen).
 * Aufrufer muss zuvor Re-Authentifizierung prüfen; der Export wird auditiert.
 */
export async function exportOrdersCsv(actorUserId: string, f: OrderFilter): Promise<string> {
  await assertPerm(actorUserId, "finance.read");
  const rows = await db.order.findMany({ where: orderWhere(f), orderBy: { createdAt: "desc" }, take: 10_000, include: { invoice: true } });
  const head = ["order_id", "created_at", "kind", "ref_key", "amount_cents", "currency", "provider", "status", "paid_at", "invoice_number"];
  const lines = [head.join(";")];
  for (const o of rows) {
    lines.push([o.id, o.createdAt, o.kind, o.refKey, o.amountCents, o.currency, o.provider, o.status, o.paidAt, o.invoice?.number].map(csvCell).join(";"));
  }
  await audit("finance.export", { actorUserId, targetType: "orders", meta: { rows: rows.length, filter: { ...f, from: f.from?.toISOString(), to: f.to?.toISOString() } } });
  return lines.join("\n") + "\n";
}

/**
 * Manueller Abgleich einer Banküberweisung – KEINE stille Statusänderung:
 * erzeugt eine Payment-Zeile (method "bank_transfer"), auditiert die Begründung und
 * erfüllt die Bestellung über dieselben exportierten Bausteine wie der Webhook-Pfad
 * (postLedger mit identischem idemKey „purchase:<orderId>“, activatePlanFromOrder, Ticketstatus).
 *
 * Hinweis: fulfil()/issueInvoice() in payments/service.ts sind nicht exportiert. Daher wird hier
 * KEINE Rechnung erzeugt (siehe docs/admin-coverage.md) – das ist bewusst offen gelassen.
 */
export async function confirmBankTransfer(actorUserId: string, orderId: string, input: { reference: string; amountCents: number; reason: string }) {
  await assertPerm(actorUserId, "finance.manage");
  const reason = requireReason(input.reason);
  const reference = input.reference.trim();
  if (reference.length < 4 || reference.length > 80) throw new AppError("reference", "Bitte Verwendungszweck/Bankreferenz (4–80 Zeichen) angeben.");
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!locked.length) throw notFound("Bestellung nicht gefunden.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!["created", "pending", "failed"].includes(order.status)) throw new AppError("state", `Bestellung mit Status „${order.status}“ kann nicht manuell bestätigt werden.`);
    if (input.amountCents !== order.amountCents) throw new AppError("amount", "Betrag stimmt nicht mit der Bestellung überein.");
    const dup = await tx.payment.findUnique({ where: { provider_providerTxId: { provider: "bank_transfer", providerTxId: reference } } });
    if (dup) throw new AppError("duplicate", "Diese Bankreferenz wurde bereits verbucht.");
    const now = new Date();
    await tx.payment.create({
      data: { orderId, provider: "bank_transfer", providerTxId: reference, amountCents: input.amountCents, currency: order.currency, status: "succeeded", method: "bank_transfer" },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: "paid", paidAt: now } });
    if (order.kind === "tokens" && order.profileId) {
      const [key, ver] = order.refKey.split(":v");
      const pkg = await tx.tokenPackageVersion.findUniqueOrThrow({ where: { key_version: { key, version: Number(ver) } } });
      await postLedger(tx, { profileId: order.profileId, delta: pkg.tokens, kind: "purchase", idemKey: `purchase:${order.id}`, refType: "order", refId: order.id, actorUserId });
    } else if (order.kind === "subscription") {
      await activatePlanFromOrder(tx, order.id, undefined, now, false);
    } else if (order.kind === "ticket") {
      await tx.ticketOrder.updateMany({ where: { id: order.refKey, status: { in: ["reserved", "awaiting_provider"] } }, data: { status: "paid", paidAt: now } });
      await tx.discountRedemption.updateMany({ where: { ticketOrderId: order.refKey, status: "reserved" }, data: { status: "redeemed" } });
    }
    await tx.order.update({ where: { id: orderId }, data: { fulfilledAt: now } });
    await issueInvoice(tx, orderId, input.amountCents);
    await enqueue(tx, "notify.user", { userId: order.userId, kind: "payment", title: "Zahlung bestätigt", link: "/app/konto" });
    await audit("finance.bank_transfer_confirmed", { actorUserId, targetType: "order", targetId: orderId, meta: { reference, amountCents: input.amountCents, reason } }, tx);
  }, { timeout: 20000 });
}
