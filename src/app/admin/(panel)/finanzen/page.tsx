import Link from "next/link";
import { db } from "@/server/db";
import { orderWhere } from "@/server/admin/finance";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, ReauthNotice, StatusBadge, money, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ORDER_STATUSES, orderFilterFrom } from "./filters";
import { PLAN_LABEL } from "@/domain/plans";

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("finance.read");
  const params = await searchParams;
  const tab = sp(params, "tab") || "orders";
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const f = orderFilterFrom(params);
  const exportQuery = new URLSearchParams(Object.entries(params).filter(([k, v]) => typeof v === "string" && v && k !== "page" && k !== "tab") as [string, string][]).toString();

  const tabs = [["orders", "Bestellungen"], ["subs", "Abos"], ["refunds", "Erstattungen & Chargebacks"]];
  return (
    <>
      <PageHead title="Finanzen">Bestellungen, Abos, Erstattungen. Es werden keine Kartendaten gespeichert.</PageHead>
      <nav className="row" aria-label="Ansicht">{tabs.map(([k, l]) => <Link key={k} className={`btn small ${tab === k ? "" : "secondary"}`} href={`/admin/finanzen?tab=${k}`}>{l}</Link>)}</nav>

      {tab === "orders" && (
        <>
          <form method="get" className="admin-search row" role="search" style={{ marginTop: 16 }}>
            <input type="hidden" name="tab" value="orders" />
            <div className="field"><label htmlFor="q">Bestell-ID, Anbieterref. oder Rechnungsnr.</label><input id="q" name="q" defaultValue={f.q} /></div>
            <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={f.status ?? ""}><option value="">alle</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="kind">Art</label><select id="kind" name="kind" defaultValue={f.kind ?? ""}><option value="">alle</option><option value="subscription">Abo</option><option value="tokens">Tokens</option><option value="ticket">Ticket</option></select></div>
            <div className="field"><label htmlFor="provider">Anbieter</label><input id="provider" name="provider" defaultValue={f.provider} /></div>
            <div className="field"><label htmlFor="from">Von</label><input id="from" name="from" type="date" defaultValue={sp(params, "from")} /></div>
            <div className="field"><label htmlFor="to">Bis (exkl.)</label><input id="to" name="to" type="date" defaultValue={sp(params, "to")} /></div>
            <button className="btn small" type="submit">Filtern</button>
          </form>
          <Orders where={orderWhere(f)} skip={skip} take={take} page={page} params={params} />
          <section className="admin-section card">
            <h2>CSV-Export</h2>
            <ReauthNotice reauthAt={a.session.reauthAt} next="/admin/finanzen" />
            <p className="muted">Exportiert die gefilterten Bestellungen (ohne E-Mail-Adressen, keine Kartendaten). Jeder Export wird protokolliert.</p>
            <a className="btn secondary" href={`/admin/finanzen/export?${exportQuery}`}>CSV herunterladen</a>
          </section>
        </>
      )}
      {tab === "subs" && <Subs skip={skip} take={take} page={page} params={params} />}
      {tab === "refunds" && <Refunds skip={skip} take={take} page={page} params={params} />}
    </>
  );
}

async function Orders({ where, skip, take, page, params }: { where: ReturnType<typeof orderWhere>; skip: number; take: number; page: number; params: SP }) {
  const [rows, total] = await Promise.all([db.order.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }), db.order.count({ where })]);
  if (!rows.length) return <Empty title="Keine Bestellungen" />;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Bestellung</th><th>Erstellt</th><th>Art</th><th>Bezug</th><th>Betrag</th><th>Anbieter</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link className="admin-mono" href={`/admin/finanzen/${o.id}`}>{o.id.slice(0, 10)}…</Link></td>
                <td>{formatDate(o.createdAt, true)}</td><td>{o.kind}</td><td>{o.refKey.slice(0, 24)}</td><td>{money(o.amountCents, o.currency)}</td><td>{o.provider}</td><td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/finanzen" params={params} page={page} total={total} />
    </>
  );
}

async function Subs({ skip, take, page, params }: { skip: number; take: number; page: number; params: SP }) {
  const [rows, total] = await Promise.all([db.subscription.findMany({ skip, take, orderBy: { createdAt: "desc" }, include: { planVersion: true } }), db.subscription.count()]);
  if (!rows.length) return <Empty title="Keine Abos" />;
  return (
    <>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Abo</th><th>Tarif</th><th>Version</th><th>Anbieter</th><th>Status</th><th>Periode</th><th>Nächster Betrag</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="admin-mono">{s.id.slice(0, 10)}…</td><td>{PLAN_LABEL[s.plan]}</td><td>v{s.planVersion.version}</td><td>{s.provider}</td>
                <td><StatusBadge status={s.status} /></td><td>{formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}</td><td>{money(s.nextPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/finanzen" params={params} page={page} total={total} />
    </>
  );
}

async function Refunds({ skip, take, page, params }: { skip: number; take: number; page: number; params: SP }) {
  const [rows, total] = await Promise.all([db.refund.findMany({ skip, take, orderBy: { createdAt: "desc" }, include: { order: { select: { currency: true } } } }), db.refund.count()]);
  if (!rows.length) return <Empty title="Keine Erstattungen oder Chargebacks" />;
  return (
    <>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Zeit</th><th>Art</th><th>Bestellung</th><th>Betrag</th><th>Grund</th><th>Anbieterref.</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.createdAt, true)}</td><td><StatusBadge status={r.kind} /></td>
                <td><Link className="admin-mono" href={`/admin/finanzen/${r.orderId}`}>{r.orderId.slice(0, 10)}…</Link></td>
                <td>{money(r.amountCents, r.order.currency)}</td><td>{r.reason}</td><td>{r.providerRef ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/finanzen" params={params} page={page} total={total} />
    </>
  );
}
