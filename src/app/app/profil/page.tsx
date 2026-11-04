import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { profilePhoto } from "@/server/uploads";
import { HiddenForm } from "@/app/app/_components/forms";
import { switchProfileAction } from "@/app/actions/member/profile";
import { PLAN_LABEL } from "@/domain/plans";
import { PROFILE_TYPE_LABEL } from "@/app/app/_lib/options";
import { regionLabel } from "@/server/discover";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function MeinProfil() {
  const { v } = await actingProfile();
  const p = v.profileRow;
  const statusNote = p.status === "pending_partner" ? "Wartet auf die Partnerperson" : null;
  const links: [string, string, string][] = [
    ["/app/profil/bearbeiten", "Profil bearbeiten", "Überschrift, Text, Interessen, Region, Kontaktfilter und Privatsphäre."],
    ["/app/profil/fotos", "Fotos", "Profilbild und Galerie mit Freigaben verwalten."],
    [`/app/profil/${encodeURIComponent(p.handle)}`, "Vorschau", "So sehen andere Mitglieder dein Profil."],
    ...(p.type === "couple" ? [["/app/profil/paar", "Paarprofil", "Partnerperson einladen, Paar verlassen oder umwandeln."] as [string, string, string]] : []),
    ["/app/verifizierung", "Verifizierung", "Identität prüfen lassen – Voraussetzung für Community, Spiele, Premium und Gold."],
    ["/app/konto", "Konto & Tarif", "Mitgliedschaft, Tokens, Rechnungen."],
    ["/app/profil/sicherheit", "Sicherheit", "Passwort, Zwei-Faktor-Anmeldung, angemeldete Geräte."],
    ["/app/profil/datenschutz", "Datenschutz", "Datenexport, Blockierungen, Einwilligungen, Konto löschen."],
    ["/app/dates", "Dates", "Persönliche und Gruppen-Dates."],
    ["/app/anrufe", "Anrufe", "Audio- und Videoanrufe mit Kontakten."],
    ["/app/benachrichtigungen", "Benachrichtigungen", "Alle Hinweise im Überblick."],
  ];
  return (
    <div className="stack">
      <div className="card row" style={{ gap: 20 }}>
        <Avatar name={p.handle} size="lg" photoId={(await profilePhoto(p.id))?.id} />
        <div className="stack" style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>{p.handle}</h1>
          <div className="row">
            <span className="badge neutral">{PROFILE_TYPE_LABEL[p.type]}</span>
            <VerifiedBadge verified={v.verified} />
            <span className="badge plan">{PLAN_LABEL[v.person.plan]}</span>
            <span className="badge neutral">{p.tokenBalance} Tokens</span>
            {statusNote && <span className="badge unverified">{statusNote}</span>}
          </div>
          {regionLabel(p) && <span className="muted">{regionLabel(p)}</span>}
        </div>
      </div>
      {v.memberships.length > 1 && (
        <section className="card stack" aria-labelledby="switch-h">
          <h2 id="switch-h">Profil wechseln</h2>
          <p className="muted" style={{ margin: 0 }}>Du bist mit mehreren Profilen verknüpft. Aktionen gelten immer für das aktive Profil.</p>
          <div className="row">
            {v.memberships.map((m) => m.profileId === p.id
              ? <span key={m.profileId} className="badge verified">{m.profile.handle} (aktiv)</span>
              : <HiddenForm key={m.profileId} action={switchProfileAction} fields={{ profileId: m.profileId }} submit={`Zu ${m.profile.handle} wechseln`} />)}
          </div>
        </section>
      )}
      <div className="grid grid-3">
        {links.map(([href, t, d]) => (
          <Link key={href} href={href} className="card card-link"><h2 style={{ fontSize: "1.15rem" }}>{t}</h2><p className="muted" style={{ margin: 0 }}>{d}</p></Link>
        ))}
      </div>
    </div>
  );
}
