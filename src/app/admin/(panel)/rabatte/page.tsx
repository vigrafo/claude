import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, Kpi, PageHead, Pager, SearchBar, Select, StatusBadge, money, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { discountRuleAction } from "@/app/actions/admin/content";

export default async function RabattePage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("discounts.manage");
  const params = await searchParams;
  const status = sp(params, "status");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where = status ? { status } : {};
  const [rules, rows, total, stats] = await Promise.all([
    db.discountRule.findMany({ orderBy: { key: "asc" } }),
    db.discountRedemption.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { rule: { select: { key: true } }, profile: { select: { handle: true } } } }),
    db.discountRedemption.count({ where }),
    db.discountRedemption.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountCents: true } }),
  ]);
  const events = await db.event.findMany({ where: { id: { in: rows.map((r) => r.eventId) } }, select: { id: true, title: true } });
  return (
    <>
      <PageHead title="Gold-Rabatte">Ein Rabatt je Regel, Event und Profil. Nur für Gold-Mitglieder mit vollständiger Verifizierung.</PageHead>
      <section className="admin-section grid grid-4">
        {stats.length === 0 && <Kpi label="Einlösungen" value={0} />}
        {stats.map((s) => <Kpi key={s.status} label={`${s.status}`} value={`${s._count._all} · ${money(s._sum.amountCents ?? 0)}`} />)}
      </section>
      {rules.map((r) => (
        <section key={r.id} className="card admin-section">
          <h2>Regel {r.key} <span className="badge plan">{r.plan}</span></h2>
          <ActionForm action={discountRuleAction} submit="Speichern">
            <input type="hidden" name="id" value={r.id} />
            <Field label="Betrag (Cent)" name="amountCents" type="number" defaultValue={r.amountCents} />
            <Field label="Limit je Event und Profil" name="perEventLimit" type="number" defaultValue={r.perEventLimit} />
            <Select label="Finanziert durch" name="fundedBy" defaultValue={r.fundedBy} options={[{ value: "eropub", label: "eropub" }, { value: "organizer", label: "Veranstalter" }, { value: "shared", label: "geteilt" }]} />
            <Field label="Aktiv" name="active" type="checkbox" defaultValue={r.active ? "1" : ""} />
            <Field label="Mit anderen Gutscheinen kombinierbar" name="combinable" type="checkbox" defaultValue={r.combinable ? "1" : ""} />
          </ActionForm>
        </section>
      ))}
      <section className="admin-section">
        <h2>Einlösungen</h2>
        <SearchBar base="/admin/rabatte" params={params} noQuery filters={[{ name: "status", label: "Status", options: ["reserved", "redeemed", "released"].map((s) => ({ value: s, label: s })) }]} />
        {rows.length === 0 ? <Empty title="Keine Einlösungen" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Zeit</th><th>Regel</th><th>Event</th><th>Profil</th><th>Betrag</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td>{formatDate(r.createdAt, true)}</td><td>{r.rule.key}</td><td>{events.find((e) => e.id === r.eventId)?.title ?? r.eventId}</td><td>{r.profile.handle}</td><td>{money(r.amountCents)}</td><td><StatusBadge status={r.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/rabatte" params={params} page={page} total={total} />
      </section>
    </>
  );
}
