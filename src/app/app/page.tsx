import Link from "next/link";
import { requireViewer } from "@/lib/viewer";
import { db } from "@/server/db";
import { VerifiedBadge } from "@/components/ui";
import { PLAN_LABEL } from "@/domain/plans";

export default async function Dashboard() {
  const v = await requireViewer();
  const p = v.profileRow;
  const [requests, conversations, invites] = p
    ? await Promise.all([
        db.messageRequest.count({ where: { toProfileId: p.id, status: "pending" } }),
        db.conversationParticipant.count({ where: { profileId: p.id } }),
        db.gameParticipant.count({ where: { profileId: p.id, status: "invited" } }),
      ])
    : [0, 0, 0];
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Hallo {p?.handle ?? ""}</h1>
          <div className="row">
            <VerifiedBadge verified={v.verified} />
            <span className="badge plan">{PLAN_LABEL[v.person.plan]}</span>
            {p && <span className="badge neutral">{p.tokenBalance} Tokens</span>}
          </div>
        </div>
        <Link className="btn" href="/app/entdecken">Profile entdecken</Link>
      </div>

      {!v.verified && (
        <div className="alert warn">
          {p?.type === "couple" && p.status === "pending_partner"
            ? <>Dein Paarprofil wartet auf deine Partnerperson. <Link href="/app/profil/paar">Partner:in einladen</Link></>
            : <>Verifiziere deine Identität, um Gruppen, Foren, Spiele, Premium und Gold zu nutzen. <Link href="/app/verifizierung">Jetzt verifizieren</Link></>}
        </div>
      )}

      <div className="grid grid-4">
        <Link className="card card-link" href="/app/nachrichten?ordner=anfragen"><div className="kpi">{requests}</div><div className="muted">offene Nachrichtenanfragen</div></Link>
        <Link className="card card-link" href="/app/nachrichten"><div className="kpi">{conversations}</div><div className="muted">Unterhaltungen</div></Link>
        <Link className="card card-link" href="/app/spiele"><div className="kpi">{invites}</div><div className="muted">Spiel-Einladungen</div></Link>
        <Link className="card card-link" href="/app/konto"><div className="kpi">{p?.tokenBalance ?? 0}</div><div className="muted">Tokens</div></Link>
      </div>

      <div className="grid grid-3">
        {[
          ["/app/profil/bearbeiten", "Profil bearbeiten", "Interessen, Kontaktwünsche, Region und Grenzen pflegen."],
          ["/app/entdecken/bilder", "Bildentdeckung", "Like oder weiter – ein Like gibt noch keinen Kontakt frei."],
          ["/app/dates", "Dates", "Persönliche und Gruppen-Dates mit PLZ-Umkreissuche."],
          ["/app/community", "Gruppen & Foren", "16 offizielle Themenbereiche und geprüfte Gruppen."],
          ["/app/clubs", "Clubs", "Von eropub geprüfte Clubs mit Sternebewertung."],
          ["/app/gold", "Gold-Bibliothek", "Redaktionelle Artikel, Interviews und Workshops."],
        ].map(([href, t, d]) => (
          <Link key={href} href={href} className="card card-link"><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></Link>
        ))}
      </div>
    </div>
  );
}
