import { ActionForm } from "@/components/ActionForm";
import { contactAction } from "@/app/actions/contact";
import { getSetting } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function Kontakt() {
  const addr = await getSetting("contact.addresses");
  return (
    <div className="narrow section">
      <h1>Kontakt</h1>
      <p className="muted">
        Allgemeiner Kontakt: <a href={`mailto:${addr.contact}`}>{addr.contact}</a> · Informationen: <a href={`mailto:${addr.info}`}>{addr.info}</a>.
        Bitte sende uns niemals Ausweiskopien per E-Mail.
      </p>
      <div className="card">
        <ActionForm action={contactAction} submit="Nachricht senden" resetOnSuccess>
          <div className="field"><label htmlFor="email">Deine E-Mail-Adresse</label><input id="email" name="email" type="email" autoComplete="email" /></div>
          <div className="field">
            <label htmlFor="topic">Thema</label>
            <select id="topic" name="topic"><option value="allgemein">Allgemein</option><option value="konto">Konto & Verifizierung</option><option value="zahlung">Zahlung</option><option value="sicherheit">Sicherheit & Meldung</option><option value="presse">Presse & Kooperation</option></select>
          </div>
          <div className="field"><label htmlFor="body">Nachricht</label><textarea id="body" name="body" required minLength={10} maxLength={5000} /></div>
          <div style={{ position: "absolute", left: -9999 }} aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        </ActionForm>
      </div>
    </div>
  );
}
