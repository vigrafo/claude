import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireViewer } from "@/lib/viewer";
import { ActionForm } from "@/components/ActionForm";
import { createProfileAction } from "@/app/actions/member/profile";
import { EUROPE } from "@/domain/countries";

export const metadata: Metadata = { title: "Profil anlegen" };

export default async function NeuesProfil() {
  const v = await requireViewer();
  if (v.profileRow) redirect("/app/profil");
  const year = new Date().getFullYear();
  return (
    <div className="narrow stack">
      <h1>Profil anlegen</h1>
      <div className="alert info" role="note">
        <strong>Dein Konto ({v.user.email}) hat noch kein Community-Profil.</strong> Ohne Profil kannst du Entdecken, Nachrichten,
        Community, Events und Spiele noch nicht nutzen – deshalb landest du hier. Das betrifft z. B. Admin-Konten, die im Terminal
        angelegt wurden, oder Konten nach einer Paartrennung. Einmal ausfüllen, dann ist alles freigeschaltet.
      </div>
      <div className="card">
        <ActionForm action={createProfileAction} submit="Profil anlegen">
          <fieldset>
            <legend>Profiltyp</legend>
            <label className="check"><input type="radio" name="profileType" value="single" defaultChecked /> Einzelprofil</label>
            <label className="check"><input type="radio" name="profileType" value="couple" /> Paarprofil – deine Partnerperson tritt mit eigenem Login bei</label>
            <p className="hint" style={{ marginBottom: 0 }}>
              So funktioniert ein Paarprofil: Du legst das gemeinsame Profil an (hier nur mit <em>deinem</em> Geburtsjahr). Danach lädst du
              deine Partnerperson per E-Mail ein. Sie legt ein eigenes Konto mit eigenem Passwort an, tritt dem Profil bei und trägt ihr
              Geburtsjahr selbst ein. Geteilte Passwörter gibt es bewusst nicht. „Verifiziert“ wird das Paarprofil, sobald beide Personen geprüft sind.
            </p>
          </fieldset>
          <div className="field">
            <label htmlFor="handle">Pseudonym</label>
            <input id="handle" name="handle" type="text" required minLength={3} maxLength={24} aria-describedby="handle-hint" />
            <p className="hint" id="handle-hint">3–24 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich.</p>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="birthYear">Dein Geburtsjahr</label>
              <input id="birthYear" name="birthYear" type="number" required min={year - 110} max={year - 18} inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="country">Land</label>
              <select id="country" name="country" defaultValue="DE">
                {EUROPE.map((c) => <option key={c.code} value={c.code}>{c.nameDe}</option>)}
              </select>
            </div>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
