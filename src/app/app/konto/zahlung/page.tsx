import Link from "next/link";
import type { Metadata } from "next";
import { actingUser } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Zahlungsstatus" };
export const dynamic = "force-dynamic";

/**
 * Rückkehrseite vom Zahlungsanbieter: zeigt NUR den Status. Erfüllung geschieht ausschließlich
 * über signierte Webhooks – nie über diese Seite.
 */
export default async function Zahlung({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: id } = await searchParams;
  const { userId } = await actingUser();
  const order = id ? await db.order.findUnique({ where: { id } }) : null;
  if (!order || order.userId !== userId) {
    return (<div className="narrow stack"><h1>Zahlung</h1><p className="alert error" role="alert">Diese Bestellung haben wir nicht gefunden.</p><Link href="/app/konto">Zum Konto</Link></div>);
  }
  const what = order.kind === "subscription" ? "Mitgliedschaft" : order.kind === "tokens" ? "Tokens" : "Ticket";
  const done = order.status === "paid" && order.fulfilledAt;
  const failed = ["failed", "canceled"].includes(order.status);
  return (
    <div className="narrow stack">
      <h1>Zahlung</h1>
      <div className="card stack" aria-live="polite">
        <p style={{ margin: 0 }}>{what} · {formatCents(order.amountCents, order.currency)}</p>
        {done ? (
          <p className="alert ok" style={{ margin: 0 }}>Zahlung bestätigt – alles ist freigeschaltet.</p>
        ) : failed ? (
          <p className="alert error" style={{ margin: 0 }}>Die Zahlung war nicht erfolgreich. Es wurde nichts belastet oder freigeschaltet.</p>
        ) : order.status === "paid" ? (
          <p className="alert info" style={{ margin: 0 }}>Zahlung eingegangen – wird gerade freigeschaltet …</p>
        ) : ["refunded", "chargeback", "partially_refunded"].includes(order.status) ? (
          <p className="alert warn" style={{ margin: 0 }}>Diese Zahlung wurde erstattet bzw. zurückgebucht.</p>
        ) : (
          <>
            <p className="alert info" style={{ margin: 0 }}>Zahlung wird bestätigt … Das dauert meist nur einen Moment. Sobald der Zahlungsanbieter bestätigt, wird freigeschaltet.</p>
            <Link className="btn secondary small" href={`/app/konto/zahlung?order=${order.id}`}>Status aktualisieren</Link>
          </>
        )}
      </div>
      <div className="row">
        <Link className="btn" href="/app/konto">Zum Konto</Link>
        {order.kind === "ticket" && <Link className="btn secondary" href="/app/events">Zu den Events</Link>}
      </div>
    </div>
  );
}
