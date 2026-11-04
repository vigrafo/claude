import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { confirmEmail, resendVerificationAction } from "@/app/actions/auth";
import { getViewer } from "@/lib/viewer";
import { devOutbox } from "@/server/mail";

export const dynamic = "force-dynamic";

export default async function Bestaetigen({ searchParams }: { searchParams: Promise<{ token?: string; neu?: string }> }) {
  const sp = await searchParams;
  if (sp.token) {
    const ok = await confirmEmail(sp.token);
    return (
      <div className="narrow section">
        <h1>{ok ? "E-Mail bestätigt" : "Link ungültig"}</h1>
        <p className="muted">{ok ? "Danke! Dein Konto ist aktiv." : "Der Link ist ungültig, bereits benutzt oder abgelaufen."}</p>
        <Link className="btn" href={ok ? "/app" : "/anmelden"}>{ok ? "Zur Community" : "Zur Anmeldung"}</Link>
      </div>
    );
  }
  const v = await getViewer();
  const devLink = process.env.APP_ENV !== "production" && v ? devOutbox.filter((m) => m.to === v.user.email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0] : undefined;
  return (
    <div className="narrow section">
      <h1>Bitte bestätige deine E-Mail-Adresse</h1>
      <p className="muted">{sp.neu ? "Willkommen! " : ""}Wir haben dir eine E-Mail mit einem Bestätigungslink gesendet. Der Link ist 48 Stunden gültig.</p>
      {devLink && (
        <div className="alert warn">
          Entwicklungsmodus: Es werden keine echten E-Mails versendet. <a href={devLink.replace(process.env.APP_URL ?? "", "")}>Bestätigungslink öffnen</a>
        </div>
      )}
      {v && (
        <ActionForm action={resendVerificationAction} submit="E-Mail erneut senden" submitClass="btn secondary" />
      )}
    </div>
  );
}
