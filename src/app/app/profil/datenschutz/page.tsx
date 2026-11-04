import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { listBlocked } from "@/server/contacts";
import { db } from "@/server/db";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm } from "@/app/app/_components/forms";
import { unblockAction } from "@/app/actions/member/contacts";
import { requestDeletionAction } from "@/app/actions/member/profile";
import { formatDate } from "@/components/ui";

export const metadata: Metadata = { title: "Datenschutz" };

const CONSENT_LABEL: Record<string, string> = {
  terms: "Nutzungsbedingungen", privacy: "Datenschutzerklärung", adult_self_declaration: "Bestätigung: mindestens 18 Jahre",
  sensitive_profile_data: "Sensible Profilangaben", biometric_verification: "Biometrischer Abgleich bei der Verifizierung", marketing: "Newsletter",
};

export default async function Datenschutz() {
  const { userId, profileId } = await actingProfile();
  const [blocked, consents, deletion] = await Promise.all([
    listBlocked(userId, profileId),
    db.consentRecord.findMany({ where: { userId }, orderBy: { givenAt: "desc" } }),
    db.deletionRequest.findFirst({ where: { userId, status: { in: ["requested", "scheduled"] } } }),
  ]);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Datenschutz</h1>
        <Link className="btn ghost small" href="/app/profil">Zurück</Link>
      </div>

      <section className="card stack" aria-labelledby="exp-h">
        <h2 id="exp-h">Deine Daten herunterladen</h2>
        <p className="muted" style={{ margin: 0 }}>Du erhältst eine JSON-Datei mit deinem Konto, Profilen, Einwilligungen, Bestellungen, gesendeten Nachrichten und Tokenbuchungen.</p>
        <div><a className="btn secondary" href="/app/profil/datenschutz/export" download>Datenexport herunterladen</a></div>
      </section>

      <section className="card stack" aria-labelledby="blk-h">
        <h2 id="blk-h">Blockierte Profile</h2>
        {blocked.length === 0 ? <p className="muted" style={{ margin: 0 }}>Du hast niemanden blockiert.</p> : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {blocked.map((b) => (
              <li key={b.id} className="row between card tight">
                <span>{b.blocked.handle} <span className="dim">seit {formatDate(b.createdAt)}</span></span>
                <HiddenForm action={unblockAction} fields={{ targetId: b.blocked.id }} submit="Aufheben" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="con-h">
        <h2 id="con-h">Einwilligungen</h2>
        {consents.length === 0 ? <p className="muted">Keine Einträge.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Was</th><th scope="col">Version</th><th scope="col">Erteilt</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {consents.map((c) => (
                  <tr key={c.id}><td>{CONSENT_LABEL[c.kind] ?? c.kind}</td><td>{c.version}</td><td>{formatDate(c.givenAt)}</td><td>{c.revokedAt ? `widerrufen ${formatDate(c.revokedAt)}` : "aktiv"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ margin: 0 }}>Fragen zu Einwilligungen oder Widerruf? <Link href="/kontakt">Kontakt</Link></p>
      </section>

      <section className="card stack" aria-labelledby="del-h">
        <h2 id="del-h">Konto löschen</h2>
        {deletion ? (
          <p className="alert warn" style={{ margin: 0 }}>Löschung beantragt – geplant für {formatDate(deletion.scheduledFor)}.</p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Dein Profil wird sofort unsichtbar und du wirst überall abgemeldet. Nach 7 Tagen werden deine Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten (z. B. für Rechnungen) bestehen. Bei einem Paarprofil verlässt du das Paar; deine Partnerperson behält das Profil.
            </p>
            <ActionForm action={requestDeletionAction} submit="Konto endgültig löschen" submitClass="btn danger" confirm="Konto wirklich löschen? Das kann nach Ablauf der Frist nicht rückgängig gemacht werden.">
              <div className="field">
                <label htmlFor="confirm-del">Zur Bestätigung „LÖSCHEN“ eingeben</label>
                <input id="confirm-del" name="confirm" type="text" autoComplete="off" required />
              </div>
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}
