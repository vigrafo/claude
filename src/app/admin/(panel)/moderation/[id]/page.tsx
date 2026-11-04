import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { CASE_STATUSES, MOD_ACTIONS } from "@/server/admin/moderation";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Select, StatusBadge, TextArea } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { appealAction, caseActionAction, caseUpdateAction } from "@/app/actions/admin/moderation";

const ACTION_LABEL: Record<string, string> = { note: "Notiz", hide: "Ausblenden", remove: "Entfernen", warn: "Verwarnen", suspend: "Sperren", restore: "Wiederherstellen" };

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await adminGuard("moderation.handle");
  const { id } = await params;
  const c = await db.moderationCase.findUnique({ where: { id }, include: { actions: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  const reports = await db.report.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHead title={`Fall ${c.number}`}><Link href="/admin/moderation">← Zur Liste</Link></PageHead>
      <section className="card">
        <dl className="admin-kv">
          <dt>Ziel</dt><dd>{c.targetType} · <span className="admin-mono">{c.targetId}</span>{c.targetType === "message" && <> · <Link href="/admin/nachrichten">Beleg über Nachrichten-Bereich</Link></>}</dd>
          <dt>Status</dt><dd><StatusBadge status={c.status} /> · Priorität {c.priority}</dd>
          <dt>Frist</dt><dd>{formatDate(c.dueAt, true)}</dd>
          <dt>Zuständig</dt><dd>{c.assigneeId === a.user.id ? "ich" : c.assigneeId ?? "–"}</dd>
          <dt>Entscheidung</dt><dd>{c.decision ?? "–"} {c.reasoning ? `· ${c.reasoning}` : ""}</dd>
          <dt>Einspruch</dt><dd>{c.appealText ?? "–"}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Meldungen ({reports.length})</h2>
        {reports.length === 0 ? <p className="muted">Keine Meldungen verknüpft.</p> : (
          <ul>{reports.map((r) => <li key={r.id}>{formatDate(r.createdAt, true)} · {r.reason}{r.details ? ` – ${r.details}` : ""}</li>)}</ul>
        )}
      </section>
      <div className="grid grid-2">
        <section className="card">
          <h2>Maßnahme</h2>
          <ActionForm action={caseActionAction} submit="Ausführen & protokollieren" confirm="Maßnahme ausführen?">
            <input type="hidden" name="caseId" value={c.id} />
            <Select label="Aktion" name="action" options={MOD_ACTIONS.map((x) => ({ value: x, label: ACTION_LABEL[x] }))} />
            <TextArea label="Begründung (Pflicht)" name="reasoning" rows={3} required />
          </ActionForm>
        </section>
        <section className="card">
          <h2>Bearbeitung</h2>
          <ActionForm action={caseUpdateAction} submit="Speichern">
            <input type="hidden" name="caseId" value={c.id} />
            <Select label="Status" name="status" defaultValue={c.status} options={CASE_STATUSES.map((s) => s)} />
            <Select label="Zuständig" name="assignee" options={[{ value: "", label: "unverändert" }, { value: "me", label: "mir zuweisen" }, { value: "none", label: "Zuweisung entfernen" }]} />
            <Field label="Frist" name="dueAt" type="datetime-local" />
            <Field label="Priorität (0–10)" name="priority" type="number" defaultValue={c.priority} />
          </ActionForm>
        </section>
      </div>
      <section className="admin-section card">
        <h2>Einspruch</h2>
        {c.status === "appealed" ? (
          <div className="grid grid-2">
            <ActionForm action={appealAction} submit="Einspruch stattgeben (wiederherstellen)"><input type="hidden" name="caseId" value={c.id} /><input type="hidden" name="op" value="overturn" /><Field label="Begründung" name="reasoning" required /></ActionForm>
            <ActionForm action={appealAction} submit="Einspruch ablehnen" submitClass="btn secondary"><input type="hidden" name="caseId" value={c.id} /><input type="hidden" name="op" value="uphold" /><Field label="Begründung" name="reasoning" required /></ActionForm>
          </div>
        ) : (
          <ActionForm action={appealAction} submit="Einspruch erfassen" submitClass="btn secondary">
            <input type="hidden" name="caseId" value={c.id} /><input type="hidden" name="op" value="record" />
            <TextArea label="Einspruch (z. B. per Support eingegangen)" name="appeal" rows={3} />
          </ActionForm>
        )}
      </section>
      <section className="admin-section">
        <h2>Verlauf</h2>
        {c.actions.length === 0 ? <p className="muted">Noch keine Maßnahmen.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Zeit</th><th>Aktion</th><th>Person</th><th>Zweck / Begründung</th></tr></thead>
            <tbody>{c.actions.map((x) => <tr key={x.id}><td>{formatDate(x.createdAt, true)}</td><td>{ACTION_LABEL[x.action] ?? x.action}</td><td className="admin-mono">{x.actorId.slice(0, 8)}</td><td>{x.purpose ?? x.note ?? "–"}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
