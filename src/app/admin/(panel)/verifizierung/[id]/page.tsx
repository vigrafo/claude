import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Reason, Select, StatusBadge } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { verificationDecideAction, verificationEvidenceAction, verificationResubmitAction } from "@/app/actions/admin/verification";

export default async function VerificationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await adminGuard("verification.review");
  const { id } = await params;
  const c = await db.verificationCase.findUnique({ where: { id } });
  if (!c) notFound();
  const own = c.userId === a.user.id;
  const history = await db.auditEvent.findMany({ where: { targetType: "verification", targetId: c.id }, orderBy: { seq: "desc" }, take: 20 });
  return (
    <>
      <PageHead title="Verifizierungsfall"><Link href="/admin/verifizierung">← Zur Warteschlange</Link></PageHead>
      {own && <p className="alert error">Eigene Fälle dürfen nicht entschieden werden.</p>}
      <section className="card">
        <dl className="admin-kv">
          <dt>Fall</dt><dd className="admin-mono">{c.id}</dd>
          <dt>Person</dt><dd>{a.has("users.read") ? <Link href={`/admin/personen/${c.userId}`} className="admin-mono">{c.userId}</Link> : <span className="admin-mono">{c.userId}</span>}</dd>
          <dt>Status</dt><dd><StatusBadge status={c.status} /> · Priorität {c.priority}</dd>
          <dt>Anbieter</dt><dd>{c.provider} · Referenz {c.providerRef ?? "–"}</dd>
          <dt>Dokument</dt><dd>{c.documentType ?? "–"} · {c.documentCountry ?? "–"}</dd>
          <dt>Volljährigkeit (Anbieter)</dt><dd>{c.adultConfirmed === true ? "technisch bestätigt" : c.adultConfirmed === false ? "nicht bestätigt" : "keine Angabe"}</dd>
          <dt>Grund</dt><dd>{c.reason ?? "–"}</dd>
          <dt>Erstellt / aktualisiert</dt><dd>{formatDate(c.createdAt, true)} / {formatDate(c.updatedAt, true)}</dd>
          <dt>Entschieden</dt><dd>{c.decidedAt ? `${formatDate(c.decidedAt, true)} durch ${c.decidedById ?? "Anbieter"}` : "–"}</dd>
          <dt>Gültig bis</dt><dd>{formatDate(c.expiresAt)}</dd>
          <dt>Einspruch</dt><dd>{c.appealAt ? `${formatDate(c.appealAt, true)}: ${c.appealText ?? ""}` : "–"}</dd>
        </dl>
      </section>

      {!own && (
        <div className="grid grid-2 admin-section">
          <section className="card">
            <h2>Entscheidung</h2>
            <p className="hint">„Verifiziert“ ist nur möglich, wenn der Anbieter die Volljährigkeit technisch bestätigt hat – sonst wird die Freigabe abgelehnt.</p>
            <ActionForm action={verificationDecideAction} submit="Entscheidung speichern" confirm="Entscheidung speichern?">
              <input type="hidden" name="caseId" value={c.id} />
              <Select label="Entscheidung" name="decision" options={[
                { value: "verified", label: "Verifiziert" }, { value: "rejected", label: "Abgelehnt" }, { value: "revoked", label: "Entzogen" },
              ]} />
              <Reason min={3} />
            </ActionForm>
          </section>
          <section className="card">
            <h2>Nachforderung</h2>
            <p className="hint">Setzt den Fall auf „abgelehnt“ mit Grund „Nachforderung“. Die Person kann neu einreichen.</p>
            <ActionForm action={verificationResubmitAction} submit="Nachforderung senden">
              <input type="hidden" name="caseId" value={c.id} />
              <Field label="Was fehlt? (optional, neutral formuliert)" name="detail" maxLength={300} />
            </ActionForm>
          </section>
        </div>
      )}

      <section className="admin-section card">
        <h2>Belege</h2>
        {!a.has("verification.evidence") ? (
          <p className="muted">Kein Zugriff: Belege einsehen erfordert das gesonderte Recht „verification.evidence“.</p>
        ) : !c.tempEvidenceKey ? (
          <p className="muted">Zu diesem Fall ist kein Beleg gespeichert. eropub speichert keine Ausweisbilder – nur das Ergebnis des Anbieters.</p>
        ) : (
          <>
            <p className="muted">Ein temporärer Beleg ist bis {formatDate(c.evidencePurgeAt, true)} hinterlegt. Zugriff nur mit Zweckangabe; jeder Zugriff wird protokolliert.</p>
            <ActionForm action={verificationEvidenceAction} submit="Zugriff protokollieren">
              <input type="hidden" name="caseId" value={c.id} />
              <Field label="Zweck des Zugriffs" name="purpose" required minLength={10} />
            </ActionForm>
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>Verlauf (Audit)</h2>
        {history.length === 0 ? <p className="muted">Keine Einträge.</p> : (
          <ul>{history.map((h) => <li key={h.id}>{formatDate(h.createdAt, true)} · {h.action} · {h.actorUserId ?? "System"}</li>)}</ul>
        )}
      </section>
    </>
  );
}
