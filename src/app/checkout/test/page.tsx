import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireViewer } from "@/lib/viewer";
import { db } from "@/server/db";
import { ActionForm } from "@/components/ActionForm";
import { simulatePaymentAction } from "@/app/actions/member/simulate";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Test-Checkout (Simulation)" };
export const dynamic = "force-dynamic";

/** NUR ENTWICKLUNG: Simulierter Anbieter-Checkout. In Produktion nicht erreichbar. */
export default async function TestCheckout({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  if (process.env.APP_ENV === "production" || process.env.ENABLE_TEST_ADAPTERS !== "true") notFound();
  const { order: id } = await searchParams;
  const v = await requireViewer();
  const order = id ? await db.order.findUnique({ where: { id } }) : null;
  if (!order || order.userId !== v.user.id || order.provider !== "test") notFound();
  const final = !["created", "pending"].includes(order.status);
  return (
    <main id="main" className="narrow section stack">
      <div role="alert" style={{ background: "#4b2c8a", color: "#fff", padding: "16px", borderRadius: 12, textAlign: "center", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "0.1em" }}>
        SIMULATION – keine echte Zahlung
      </div>
      <h1>Test-Checkout</h1>
      <div className="card stack">
        <p style={{ margin: 0 }}>Bestellung <code>{order.id}</code></p>
        <p style={{ margin: 0 }}>{order.kind === "subscription" ? "Mitgliedschaft" : order.kind === "tokens" ? "Tokens" : "Ticket"} · <strong>{formatCents(order.amountCents, order.currency)}</strong> · Status: {order.status}</p>
        <p className="hint" style={{ margin: 0 }}>Die Buttons erzeugen einen signierten Test-Webhook und verarbeiten ihn über denselben Weg wie bei echten Anbietern.</p>
      </div>
      {final ? (
        <p className="alert info">Diese Bestellung ist bereits abgeschlossen. <Link href={`/app/konto/zahlung?order=${order.id}`}>Zum Status</Link></p>
      ) : (
        <div className="row">
          <ActionForm action={simulatePaymentAction} submit="Zahlung erfolgreich simulieren">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="outcome" value="success" />
          </ActionForm>
          <ActionForm action={simulatePaymentAction} submit="Fehlschlag simulieren" submitClass="btn danger">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="outcome" value="fail" />
          </ActionForm>
        </div>
      )}
      <Link href="/app/konto">Abbrechen und zum Konto</Link>
    </main>
  );
}
