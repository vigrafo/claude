import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Reason, StatusBadge, money } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { bankTransferAction } from "@/app/actions/admin/finance";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await adminGuard("finance.read");
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { payments: true, refunds: true, invoice: true } });
  if (!o) notFound();
  const audits = await db.auditEvent.findMany({ where: { targetType: "order", targetId: o.id }, orderBy: { seq: "desc" }, take: 20 });
  return (
    <>
      <PageHead title="Bestellung"><Link href="/admin/finanzen">← Zur Liste</Link></PageHead>
      <section className="card">
        <dl className="admin-kv">
          <dt>ID</dt><dd className="admin-mono">{o.id}</dd>
          <dt>Person</dt><dd>{a.has("users.read") ? <Link className="admin-mono" href={`/admin/personen/${o.userId}`}>{o.userId}</Link> : o.userId}</dd>
          <dt>Art / Bezug</dt><dd>{o.kind} · {o.refKey}</dd>
          <dt>Betrag</dt><dd>{money(o.amountCents, o.currency)}</dd>
          <dt>Anbieter</dt><dd>{o.provider} · Ref. {o.providerRef ?? "–"}</dd>
          <dt>Status</dt><dd><StatusBadge status={o.status} /></dd>
          <dt>Erstellt / bezahlt / erfüllt</dt><dd>{formatDate(o.createdAt, true)} / {formatDate(o.paidAt, true)} / {formatDate(o.fulfilledAt, true)}</dd>
          <dt>Rechnung</dt><dd>{o.invoice ? `${o.invoice.number} · netto ${money(o.invoice.netCents)} · USt. ${money(o.invoice.taxCents)} · brutto ${money(o.invoice.grossCents)}` : "–"}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Zahlungen</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Zeit</th><th>Anbieter</th><th>Transaktion</th><th>Methode</th><th>Betrag</th><th>Status</th></tr></thead>
          <tbody>
            {o.payments.map((p) => <tr key={p.id}><td>{formatDate(p.createdAt, true)}</td><td>{p.provider}</td><td className="admin-mono">{p.providerTxId}</td><td>{p.method ?? "–"}</td><td>{money(p.amountCents, p.currency)}</td><td>{p.status}</td></tr>)}
            {o.payments.length === 0 && <tr><td colSpan={6} className="muted">Keine Zahlungen.</td></tr>}
          </tbody>
        </table></div>
      </section>
      <section className="admin-section">
        <h2>Erstattungen / Chargebacks</h2>
        {o.refunds.length === 0 ? <p className="muted">Keine.</p> : (
          <ul>{o.refunds.map((r) => <li key={r.id}>{formatDate(r.createdAt, true)} · {r.kind} · {money(r.amountCents, o.currency)} · {r.reason}</li>)}</ul>
        )}
      </section>
      {a.has("finance.manage") && ["created", "pending", "failed"].includes(o.status) && (
        <section className="admin-section card">
          <h2>Banküberweisung manuell bestätigen</h2>
          <p className="muted">Legt eine Zahlung (Methode „bank_transfer“) an und erfüllt die Bestellung über denselben Pfad wie bei Anbieterzahlungen. Keine stille Statusänderung. Eine Rechnung wird dabei derzeit nicht automatisch erzeugt.</p>
          <ActionForm action={bankTransferAction} submit="Zahlungseingang verbuchen" confirm="Zahlungseingang verbuchen und Bestellung erfüllen?">
            <input type="hidden" name="orderId" value={o.id} />
            <Field label="Bankreferenz / Verwendungszweck" name="reference" required />
            <Field label="Eingegangener Betrag (Cent)" name="amountCents" type="number" defaultValue={o.amountCents} required />
            <Reason />
          </ActionForm>
        </section>
      )}
      <section className="admin-section">
        <h2>Audit</h2>
        {audits.length === 0 ? <p className="muted">Keine Einträge.</p> : <ul>{audits.map((h) => <li key={h.id}>{formatDate(h.createdAt, true)} · {h.action}</li>)}</ul>}
      </section>
    </>
  );
}
