import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { TICKET_STATUSES } from "@/server/admin/moderation";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Select, StatusBadge, TextArea } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { ticketReplyAction, ticketUpdateAction } from "@/app/actions/admin/moderation";

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await adminGuard("support.handle");
  const { id } = await params;
  const t = await db.supportTicket.findUnique({ where: { id }, include: { replies: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  const showEmail = a.has("users.manage");
  return (
    <>
      <PageHead title={`Ticket ${t.number}`}><Link href="/admin/support">← Zur Liste</Link></PageHead>
      <section className="card">
        <dl className="admin-kv">
          <dt>Thema</dt><dd>{t.topic}</dd>
          <dt>Status</dt><dd><StatusBadge status={t.status} /></dd>
          <dt>Von</dt><dd>{t.requesterId ? (a.has("users.read") ? <Link className="admin-mono" href={`/admin/personen/${t.requesterId}`}>Mitglied {t.requesterId.slice(0, 8)}</Link> : "Mitglied") : showEmail ? t.email ?? "–" : "Gast (E-Mail nur mit users.manage)"}</dd>
          <dt>Eingang</dt><dd>{formatDate(t.createdAt, true)}</dd>
          <dt>Zuständig</dt><dd>{t.assigneeId === a.user.id ? "ich" : t.assigneeId ?? "–"}</dd>
        </dl>
        <div className="admin-pre" style={{ marginTop: 12 }}>{t.body}</div>
      </section>
      <section className="admin-section">
        <h2>Verlauf</h2>
        {t.replies.length === 0 ? <p className="muted">Noch keine Antworten.</p> : t.replies.map((r) => (
          <div key={r.id} className="card tight" style={{ marginBottom: 8 }}>
            <div className="dim">{formatDate(r.createdAt, true)} · {r.internal ? <span className="badge neutral">interne Notiz</span> : <span className="badge verified">Antwort</span>}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>
          </div>
        ))}
      </section>
      <div className="grid grid-2">
        <section className="card">
          <h2>Antworten</h2>
          <ActionForm action={ticketReplyAction} submit="Speichern" resetOnSuccess>
            <input type="hidden" name="ticketId" value={t.id} />
            <TextArea label="Text" name="body" rows={5} required />
            <Field label="Nur interne Notiz (für Mitglied unsichtbar)" name="internal" type="checkbox" />
          </ActionForm>
          <p className="hint">Antworten erscheinen als neutrale Benachrichtigung im Konto. Gäste ohne Konto erhalten derzeit keine automatische E-Mail.</p>
        </section>
        <section className="card">
          <h2>Status & Zuständigkeit</h2>
          <ActionForm action={ticketUpdateAction} submit="Speichern">
            <input type="hidden" name="ticketId" value={t.id} />
            <Select label="Status" name="status" defaultValue={t.status} options={TICKET_STATUSES.map((s) => s)} />
            <Select label="Zuständig" name="assign" options={[{ value: "", label: "unverändert" }, { value: "me", label: "mir zuweisen" }, { value: "none", label: "Zuweisung entfernen" }]} />
          </ActionForm>
        </section>
      </div>
    </>
  );
}
