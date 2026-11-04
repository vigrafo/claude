import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { verifyAuditChain } from "@/server/audit";
import { backupStatus, releaseInfo } from "@/server/admin/ops";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Kpi, PageHead, Pager, StatusBadge, sp, type SP } from "../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { outboxRetryAction } from "@/app/actions/admin/ops";

export default async function OpsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("ops.view");
  const params = await searchParams;
  const action = sp(params, "action");
  const actor = sp(params, "actor");
  const tt = sp(params, "targetType");
  const tid = sp(params, "targetId");
  const outboxStatus = sp(params, "outbox") || "failed";
  const { page, skip, take } = pageArgs(sp(params, "page"), 50);
  const where: Prisma.AuditEventWhereInput = {};
  if (action) where.action = { startsWith: action };
  if (actor) where.actorUserId = actor;
  if (tt) where.targetType = tt;
  if (tid) where.targetId = tid;
  const [events, total, chain, outbox, outboxCounts] = await Promise.all([
    db.auditEvent.findMany({ where, skip, take, orderBy: { seq: "desc" } }),
    db.auditEvent.count({ where }),
    verifyAuditChain(),
    db.outboxEvent.findMany({ where: { status: outboxStatus }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, topic: true, status: true, attempts: true, lastError: true, createdAt: true, availableAt: true } }),
    db.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const rel = releaseInfo();
  const backup = backupStatus();
  return (
    <>
      <PageHead title="Betrieb & Audit">Nur lesend bzw. Statuswechsel – keine Shell-Ausführung, keine Wiederherstellung per Klick.</PageHead>
      <section className="admin-section grid grid-4">
        <Kpi label="Release" value={rel.version} />
        <Kpi label="Commit (APP_RELEASE)" value={rel.commit ?? "nicht gesetzt"} />
        <Kpi label="Umgebung" value={rel.env} />
        <Kpi label="Letztes erfolgreiches Backup" value={backup.configured ? backup.lastOk : "nicht konfiguriert"} />
        <Kpi label="Audit-Hashkette" value={chain.ok ? "intakt" : `gebrochen bei ${chain.brokenAt}`} />
        {outboxCounts.map((o) => <Kpi key={o.status} label={`Outbox ${o.status}`} value={o._count._all} />)}
      </section>

      <section className="admin-section">
        <h2>Outbox</h2>
        <form method="get" className="admin-search row">
          <div className="field"><label htmlFor="outbox">Status</label>
            <select id="outbox" name="outbox" defaultValue={outboxStatus}>{["failed", "pending", "done"].map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <button className="btn small" type="submit">Anzeigen</button>
        </form>
        {outbox.length === 0 ? <p className="muted">Keine Ereignisse mit Status „{outboxStatus}“.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Erstellt</th><th>Thema</th><th>Status</th><th>Versuche</th><th>Nächster Versuch</th><th>Fehler</th><th>Aktion</th></tr></thead>
            <tbody>{outbox.map((o) => (
              <tr key={o.id}><td>{formatDate(o.createdAt, true)}</td><td>{o.topic}</td><td><StatusBadge status={o.status} /></td><td>{o.attempts}</td><td>{formatDate(o.availableAt, true)}</td><td>{o.lastError ?? "–"}</td>
                <td>{o.status === "failed" ? <ActionForm action={outboxRetryAction} submit="Erneut versuchen" submitClass="btn small secondary"><input type="hidden" name="id" value={o.id} /></ActionForm> : "–"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="admin-section">
        <h2>Audit-Protokoll</h2>
        <form method="get" className="admin-search row" role="search">
          <div className="field"><label htmlFor="action">Ereignis (Präfix)</label><input id="action" name="action" defaultValue={action} placeholder="z. B. role." /></div>
          <div className="field"><label htmlFor="actor">Person-ID</label><input id="actor" name="actor" defaultValue={actor} /></div>
          <div className="field"><label htmlFor="targetType">Zieltyp</label><input id="targetType" name="targetType" defaultValue={tt} /></div>
          <div className="field"><label htmlFor="targetId">Ziel-ID</label><input id="targetId" name="targetId" defaultValue={tid} /></div>
          <button className="btn small" type="submit">Filtern</button>
        </form>
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Zeit</th><th>Ereignis</th><th>Person</th><th>Ziel</th><th>Details</th><th>Hash</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}><td>{e.seq}</td><td>{formatDate(e.createdAt, true)}</td><td>{e.action}</td><td className="admin-mono">{e.actorUserId?.slice(0, 10) ?? "System"}</td><td>{e.targetType ?? ""} <span className="admin-mono">{e.targetId?.slice(0, 12) ?? ""}</span></td><td className="admin-mono">{JSON.stringify(e.meta)}</td><td className="admin-mono">{e.hash.slice(0, 10)}…</td></tr>
            ))}
            {events.length === 0 && <tr><td colSpan={7} className="muted">Keine Einträge.</td></tr>}
          </tbody>
        </table></div>
        <Pager base="/admin/betrieb" params={params} page={page} total={total} size={50} />
      </section>
    </>
  );
}
