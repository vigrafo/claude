import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, StatusBadge, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { privacyDeletionNowAction } from "@/app/actions/admin/privacy";

const SENSITIVE_ACTIONS = ["verification.evidence_access", "moderation.evidence_access", "finance.export", "privacy.export_self", "provider.secret_set", "role.granted", "tokens.admin_adjust"];

const PROCESSORS = [
  { area: "Hosting / Server", provider: "zu ergänzen", location: "zu ergänzen", basis: "Art. 28 DSGVO (AVV)" },
  { area: "E-Mail-Versand (SMTP)", provider: "zu ergänzen", location: "zu ergänzen", basis: "Art. 28 DSGVO (AVV)" },
  { area: "Zahlungsabwicklung", provider: "zu ergänzen", location: "zu ergänzen", basis: "eigene Verantwortlichkeit des Anbieters / AVV" },
  { area: "Identitäts-/Altersprüfung", provider: "zu ergänzen", location: "zu ergänzen", basis: "Art. 28 DSGVO, ggf. Art. 9 (biometrische Daten) mit Einwilligung" },
  { area: "Medienspeicher (S3-kompatibel)", provider: "zu ergänzen", location: "zu ergänzen", basis: "Art. 28 DSGVO (AVV)" },
];

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("privacy.manage");
  const params = await searchParams;
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const act = sp(params, "action");
  const auditWhere: Prisma.AuditEventWhereInput = { action: act && SENSITIVE_ACTIONS.includes(act) ? act : { in: SENSITIVE_ACTIONS } };
  const [consents, revoked, deletions, audits, auditTotal] = await Promise.all([
    db.consentRecord.groupBy({ by: ["kind", "version"], _count: { _all: true }, orderBy: [{ kind: "asc" }, { version: "desc" }] }),
    db.consentRecord.groupBy({ by: ["kind", "version"], where: { revokedAt: { not: null } }, _count: { _all: true } }),
    db.deletionRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.auditEvent.findMany({ where: auditWhere, skip, take, orderBy: { seq: "desc" } }),
    db.auditEvent.count({ where: auditWhere }),
  ]);
  return (
    <>
      <PageHead title="Datenschutz">Einwilligungen, Löschläufe, Aufbewahrung, protokollierte Zugriffe und Auftragsverarbeiter.</PageHead>
      <section className="admin-section">
        <h2>Einwilligungsversionen</h2>
        {consents.length === 0 ? <p className="muted">Noch keine Einwilligungen erfasst.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Art</th><th>Version</th><th>Erteilt</th><th>Davon widerrufen</th></tr></thead>
            <tbody>{consents.map((c) => <tr key={`${c.kind}-${c.version}`}><td>{c.kind}</td><td>{c.version}</td><td>{c._count._all}</td><td>{revoked.find((r) => r.kind === c.kind && r.version === c.version)?._count._all ?? 0}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
      <section className="admin-section">
        <h2>Löschanträge</h2>
        {deletions.length === 0 ? <Empty title="Keine Löschanträge" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Eingang</th><th>Person</th><th>Status</th><th>Geplant</th><th>Erledigt</th><th>Fehler</th><th>Aktion</th></tr></thead>
            <tbody>{deletions.map((d) => (
              <tr key={d.id}>
                <td>{formatDate(d.createdAt, true)}</td><td className="admin-mono">{d.userId.slice(0, 10)}…</td><td><StatusBadge status={d.status} /></td>
                <td>{formatDate(d.scheduledFor, true)}</td><td>{formatDate(d.doneAt, true)}</td><td>{d.error ?? "–"}</td>
                <td>{["requested", "failed"].includes(d.status) ? (
                  <ActionForm action={privacyDeletionNowAction} submit="Jetzt ausführen" submitClass="btn small danger" confirm="Löschlauf jetzt einplanen?"><input type="hidden" name="requestId" value={d.id} /></ActionForm>
                ) : "–"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="hint">„Jetzt ausführen“ setzt den Status auf „scheduled“ mit sofortigem Termin. Die Löschung führt ausschließlich der Worker aus (inkl. Löschregister gegen Wiederherstellung aus Backups).</p>
      </section>
      <section className="admin-section card">
        <h2>Aufbewahrung</h2>
        <ul>
          <li>Konto- und Profildaten: bis zur Löschung; nach Löschantrag 7 Tage Karenz, dann Löschlauf.</li>
          <li>Verifizierung: nur Ergebnis, Anbieterreferenz, Zeitpunkte, Gültigkeit. Temporäre Belege werden nach Frist automatisch entfernt.</li>
          <li>Zahlungs- und Rechnungsdaten: gesetzliche Aufbewahrungsfristen (HGB/AO), keine Kartendaten bei eropub.</li>
          <li>Audit-Protokoll: hashverkettet, ohne sensible Inhalte; Frist <strong>zu ergänzen</strong> (Vorschlag: 2 Jahre).</li>
          <li>E-Mail-Protokoll: nur gehashte Empfänger.</li>
        </ul>
        <p className="hint">Rechtliche Prüfung vor Livebetrieb erforderlich.</p>
      </section>
      <section className="admin-section">
        <h2>Protokollierte sensible Zugriffe</h2>
        <form method="get" className="admin-search row">
          <div className="field"><label htmlFor="action">Ereignis</label>
            <select id="action" name="action" defaultValue={act}><option value="">alle sensiblen</option>{SENSITIVE_ACTIONS.map((x) => <option key={x}>{x}</option>)}</select>
          </div>
          <button className="btn small" type="submit">Filtern</button>
        </form>
        {audits.length === 0 ? <p className="muted">Keine Einträge.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Zeit</th><th>Ereignis</th><th>Person</th><th>Ziel</th><th>Details</th></tr></thead>
            <tbody>{audits.map((e) => <tr key={e.id}><td>{formatDate(e.createdAt, true)}</td><td>{e.action}</td><td className="admin-mono">{e.actorUserId?.slice(0, 8) ?? "System"}</td><td>{e.targetType} {e.targetId?.slice(0, 10)}</td><td className="admin-mono">{JSON.stringify(e.meta)}</td></tr>)}</tbody>
          </table></div>
        )}
        <Pager base="/admin/datenschutz" params={params} page={page} total={auditTotal} />
      </section>
      <section className="admin-section">
        <h2>Auftragsverarbeiter</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Bereich</th><th>Anbieter</th><th>Standort</th><th>Grundlage</th></tr></thead>
          <tbody>{PROCESSORS.map((p) => <tr key={p.area}><td>{p.area}</td><td><span className="badge unverified">{p.provider}</span></td><td>{p.location}</td><td>{p.basis}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
