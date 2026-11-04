import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { registerAction } from "@/app/actions/auth";
import { EUROPE } from "@/domain/countries";

export const metadata: Metadata = { title: "Registrieren" };

export default function Registrieren() {
  const year = new Date().getFullYear();
  return (
    <div className="narrow section">
      <h1>Kostenlos registrieren</h1>
      <p className="muted">eropub ist ausschließlich für Personen ab 18 Jahren. Du wählst ein Pseudonym – dein Name wird nie veröffentlicht.</p>
      <div className="card">
        <ActionForm action={registerAction} submit="Konto anlegen">
          <fieldset>
            <legend>Profiltyp</legend>
            <label className="check"><input type="radio" name="profileType" value="single" defaultChecked /> Einzelprofil</label>
            <label className="check"><input type="radio" name="profileType" value="couple" /> Paarprofil – deine Partnerperson legt danach einen eigenen Login an</label>
          </fieldset>
          <div className="field">
            <label htmlFor="handle">Pseudonym</label>
            <input id="handle" name="handle" type="text" required minLength={3} maxLength={24} autoComplete="username" aria-describedby="handle-hint" />
            <p className="hint" id="handle-hint">3–24 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich.</p>
          </div>
          <div className="field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="password">Passwort</label>
              <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" aria-describedby="pw-hint" />
              <p className="hint" id="pw-hint">Mindestens 12 Zeichen.</p>
            </div>
            <div className="field">
              <label htmlFor="password2">Passwort wiederholen</label>
              <input id="password2" name="password2" type="password" required autoComplete="new-password" />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="birthYear">Geburtsjahr</label>
              <input id="birthYear" name="birthYear" type="number" required min={year - 110} max={year - 18} inputMode="numeric" aria-describedby="by-hint" />
              <p className="hint" id="by-hint">Nur das Jahr – für die Altersanzeige. Das vollständige Geburtsdatum wird nicht veröffentlicht.</p>
            </div>
            <div className="field">
              <label htmlFor="country">Land</label>
              <select id="country" name="country" defaultValue="DE" required>
                {EUROPE.map((c) => <option key={c.code} value={c.code}>{c.nameDe}</option>)}
              </select>
            </div>
          </div>
          <label className="check field"><input type="checkbox" name="adult" required /> Ich bin mindestens 18 Jahre alt.</label>
          <label className="check field"><input type="checkbox" name="terms" required /> Ich akzeptiere die <Link href="/seite/agb">Nutzungsbedingungen</Link> und <Link href="/seite/community-regeln">Communityregeln</Link>.</label>
          <label className="check field"><input type="checkbox" name="privacy" required /> Ich habe die <Link href="/seite/datenschutz">Datenschutzerklärung</Link> gelesen.</label>
          <p className="hint">Die Selbstauskunft ersetzt keine Altersverifikation. Für Gruppen, Foren, Spiele, Premium und Gold ist eine Identitätsprüfung erforderlich.</p>
        </ActionForm>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Schon registriert? <Link href="/anmelden">Anmelden</Link></p>
    </div>
  );
}
