import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { devOutbox } from "@/server/mail";
import { ActionForm } from "@/components/ActionForm";
import { convertToSingleAction, invitePartnerAction, leaveCoupleAction } from "@/app/actions/member/profile";
import { Gate, formatDate } from "@/components/ui";

export const metadata: Metadata = { title: "Paarprofil" };

export default async function Paar() {
  const { v, profileId } = await actingProfile();
  if (v.profileRow.type !== "couple") {
    return <Gate reason="Diese Seite gibt es nur für Paarprofile." cta={{ href: "/app/profil", label: "Zum Profil" }} />;
  }
  const [members, invite] = await Promise.all([
    db.profileMembership.findMany({ where: { profileId, status: "active" }, select: { id: true, userId: true, role: true, displayLabel: true, confirmedAt: true } }),
    db.coupleInvite.findFirst({ where: { profileId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const devLink = process.env.APP_ENV !== "production" && invite
    ? devOutbox.filter((m) => m.to === invite.email).at(-1)?.text.match(/https?:\/\/\S+/)?.[0]
    : undefined;
  const complete = members.length >= 2;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Paarprofil</h1>
        <Link className="btn ghost small" href="/app/profil">Zurück</Link>
      </div>
      <section className="card stack" aria-labelledby="m-h">
        <h2 id="m-h">Personen</h2>
        <ul style={{ margin: 0 }}>
          {members.map((m) => (
            <li key={m.id}>{m.userId === v.user.id ? "Du" : "Partnerperson"}{m.displayLabel ? ` („${m.displayLabel}“)` : ""} – {m.role === "owner" ? "hat das Profil angelegt" : "beigetreten"}{m.confirmedAt ? ` am ${formatDate(m.confirmedAt)}` : ""}</li>
          ))}
        </ul>
        <p className="hint" style={{ margin: 0 }}>Jede Person hat einen eigenen Login und verifiziert sich mit eigenem Ausweis. Ihr seht gegenseitig keine Ausweisdokumente.</p>
      </section>

      {!complete && (
        <section className="card stack" aria-labelledby="inv-h">
          <h2 id="inv-h">Partnerperson einladen</h2>
          {invite && <p className="alert info" style={{ margin: 0 }}>Offene Einladung an {invite.email}, gültig bis {formatDate(invite.expiresAt, true)}. Eine neue Einladung ersetzt sie.</p>}
          {devLink && (
            <div className="alert warn" style={{ margin: 0 }}>
              Entwicklungsmodus: Es werden keine echten E-Mails versendet. <a href={devLink.replace(process.env.APP_URL ?? "", "")}>Einladungslink öffnen</a> (nur mit dem Konto der eingeladenen Adresse).
            </div>
          )}
          <ActionForm action={invitePartnerAction} submit="Einladung senden" resetOnSuccess>
            <div className="field">
              <label htmlFor="email">E-Mail-Adresse deiner Partnerperson</label>
              <input id="email" name="email" type="email" required autoComplete="off" aria-describedby="email-hint" />
              <p className="hint" id="email-hint">Deine Partnerperson legt mit dieser Adresse ein eigenes Konto an und nimmt die Einladung angemeldet an.</p>
            </div>
          </ActionForm>
        </section>
      )}

      {complete ? (
        <section className="card stack" aria-labelledby="leave-h">
          <h2 id="leave-h">Paar verlassen</h2>
          <p className="muted" style={{ margin: 0 }}>
            Du verlässt das gemeinsame Profil. Deine Partnerperson behält es – als wartendes Paarprofil oder, wenn du es auswählst, als Einzelprofil. Laufende Spiele und Anrufe werden beendet.
          </p>
          <ActionForm action={leaveCoupleAction} submit="Paar verlassen" submitClass="btn danger" confirm="Wirklich das Paarprofil verlassen?">
            <label className="check field"><input type="checkbox" name="convert" /> Das verbleibende Profil in ein Einzelprofil umwandeln</label>
            <div className="field">
              <label htmlFor="confirm-leave">Zur Bestätigung „TRENNEN“ eingeben</label>
              <input id="confirm-leave" name="confirm" type="text" autoComplete="off" required />
            </div>
          </ActionForm>
        </section>
      ) : (
        <section className="card stack" aria-labelledby="conv-h">
          <h2 id="conv-h">In Einzelprofil umwandeln</h2>
          <p className="muted" style={{ margin: 0 }}>Wenn keine Partnerperson beitreten soll, kannst du das Profil als Einzelprofil weiterführen. Offene Einladungen werden widerrufen.</p>
          <ActionForm action={convertToSingleAction} submit="Umwandeln" submitClass="btn danger" confirm="Paarprofil wirklich in ein Einzelprofil umwandeln?">
            <div className="field">
              <label htmlFor="confirm-conv">Zur Bestätigung „EINZEL“ eingeben</label>
              <input id="confirm-conv" name="confirm" type="text" autoComplete="off" required />
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
