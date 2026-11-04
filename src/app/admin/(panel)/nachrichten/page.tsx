import Link from "next/link";
import { db } from "@/server/db";
import { evidenceGrant, EVIDENCE_VIEW_MINUTES } from "@/server/admin/moderation";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { messageEvidenceAction, reportCaseAction } from "@/app/actions/admin/messages";

export default async function NachrichtenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("messages.moderate");
  const params = await searchParams;
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const reportId = sp(params, "report");
  const accessId = sp(params, "access");
  const evidence = reportId && accessId ? await evidenceGrant(a.user.id, reportId, accessId) : null;
  const where = { targetType: "message" };
  const [reports, total, outbox] = await Promise.all([
    db.report.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    db.report.count({ where }),
    db.outboxEvent.groupBy({ by: ["status"], where: { topic: "message.created" }, _count: { _all: true } }),
  ]);
  const canEvidence = a.has("moderation.evidence");
  return (
    <>
      <PageHead title="Nachrichten (fallbezogen)">Es gibt kein Postfach-Browsing. Sichtbar sind nur gemeldete Nachrichten; der Inhalt erst mit eigenem Recht, Zweckangabe und Protokoll.</PageHead>

      {reportId && accessId && (
        evidence ? (
          <section className="card admin-section" aria-live="polite">
            <h2>Gemeldete Nachricht</h2>
            <p className="hint">Ansicht protokolliert, gültig {EVIDENCE_VIEW_MINUTES} Minuten. Absender: {evidence.senderProfile.handle}{evidence.senderLabel ? ` (${evidence.senderLabel})` : ""} · {formatDate(evidence.createdAt, true)}{evidence.deletedAt ? " · entfernt" : ""}</p>
            <div className="admin-pre">{evidence.body}</div>
            <p><Link href="/admin/nachrichten">Ansicht schließen</Link></p>
          </section>
        ) : <p className="alert error">Die Belegansicht ist abgelaufen oder nicht freigegeben.</p>
      )}

      <section className="admin-section">
        <h2>Zustellstatus (message.created)</h2>
        <div className="row">
          {outbox.length === 0 && <span className="muted">Keine Ereignisse.</span>}
          {outbox.map((o) => <span key={o.status} className="badge neutral">{o.status}: {o._count._all}</span>)}
        </div>
      </section>

      <section className="admin-section">
        <h2>Gemeldete Nachrichten</h2>
        {reports.length === 0 ? <Empty title="Keine gemeldeten Nachrichten" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Gemeldet</th><th>Grund</th><th>Details</th><th>Fall</th><th>Inhalt</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.createdAt, true)}</td>
                  <td>{r.reason}</td>
                  <td>{r.details ?? "–"}</td>
                  <td>{r.caseId ? (a.has("moderation.handle") ? <Link href={`/admin/moderation/${r.caseId}`}>Fall öffnen</Link> : "zugeordnet") : (
                    <ActionForm action={reportCaseAction} submit="Fall anlegen" submitClass="btn small secondary"><input type="hidden" name="reportId" value={r.id} /></ActionForm>
                  )}</td>
                  <td>{!canEvidence ? <span className="muted">Recht „moderation.evidence“ fehlt</span> : !r.caseId ? <span className="muted">erst Fall anlegen</span> : (
                    <ActionForm action={messageEvidenceAction} submit="Inhalt ansehen" submitClass="btn small">
                      <input type="hidden" name="reportId" value={r.id} />
                      <Field label="Zweck" name="purpose" required minLength={10} />
                    </ActionForm>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pager base="/admin/nachrichten" params={params} page={page} total={total} />
      </section>
    </>
  );
}
