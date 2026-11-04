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
      <p className="muted">Du hast derzeit kein aktives Profil – zum Beispiel nach einer Paartrennung. Lege ein neues Profil an oder nimm eine Paar-Einladung über den Link aus der E-Mail an.</p>
      <div className="card">
        <ActionForm action={createProfileAction} submit="Profil anlegen">
          <fieldset>
            <legend>Profiltyp</legend>
            <label className="check"><input type="radio" name="profileType" value="single" defaultChecked /> Einzelprofil</label>
            <label className="check"><input type="radio" name="profileType" value="couple" /> Paarprofil – deine Partnerperson tritt mit eigenem Login bei</label>
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
