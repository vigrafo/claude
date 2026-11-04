import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { listVisibleGroups } from "@/server/community";
import { db } from "@/server/db";
import { Empty, Gate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { applyGroupAction } from "@/app/actions/member/community";
import { EUROPE } from "@/domain/countries";

export const metadata: Metadata = { title: "Community" };

export default async function Community() {
  const { profileId, v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) {
    return (
      <div className="stack">
        <h1>Community</h1>
        <Gate reason={`${c.reason} Gruppen, Foren, Events und Dates stehen dir nach der Identitätsprüfung offen${v.profileRow.type === "couple" ? " – bei Paaren für beide Personen" : ""}.`} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />
      </div>
    );
  }
  const [groups, mine] = await Promise.all([
    listVisibleGroups(profileId),
    db.groupMembership.findMany({ where: { profileId }, select: { groupId: true, status: true } }),
  ]);
  const status = new Map(mine.map((m) => [m.groupId, m.status]));
  const official = groups.filter((g) => g.official);
  const others = groups.filter((g) => !g.official);
  const card = (g: (typeof groups)[number]) => (
    <Link key={g.id} href={`/app/community/${g.slug}`} className="card card-link stack">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{g.name}</h3>
        {status.get(g.id) === "active" ? <span className="badge verified">Mitglied</span> : status.get(g.id) === "pending" ? <span className="badge unverified">Angefragt</span> : null}
      </div>
      <p className="muted" style={{ margin: 0 }}>{g.description.slice(0, 160)}{g.description.length > 160 ? " …" : ""}</p>
      <div className="row">
        <span className="badge neutral">{g.category}</span>
        <span className="badge neutral">{g.visibility === "open" ? "Offen" : g.visibility === "closed" ? "Geschlossen" : "Auf Einladung"}</span>
        <span className="dim" style={{ fontSize: "0.85rem" }}>{g._count.memberships} {g._count.memberships === 1 ? "Mitglied" : "Mitglieder"}</span>
      </div>
    </Link>
  );
  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Community</h1>
        <div className="row">
          <Link className="btn secondary small" href="/app/dates">Dates</Link>
          <Link className="btn secondary small" href="/app/clubs">Clubs</Link>
        </div>
      </div>
      <section aria-labelledby="off-h" className="stack">
        <h2 id="off-h">Offizielle Themenbereiche</h2>
        {official.length ? <div className="grid grid-3">{official.map(card)}</div> : <p className="muted">Noch keine Themenbereiche.</p>}
      </section>
      <section aria-labelledby="grp-h" className="stack">
        <h2 id="grp-h">Gruppen</h2>
        {others.length ? <div className="grid grid-3">{others.map(card)}</div> : <Empty title="Noch keine weiteren Gruppen">Du kannst eine Gruppe beantragen – das eropub-Team prüft jeden Antrag.</Empty>}
      </section>
      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Gruppe beantragen</summary>
        <div style={{ marginTop: 12 }}>
          <p className="muted">Gruppen werden erst nach Prüfung durch eropub sichtbar. Inhalte bleiben respektvoll und nicht explizit.</p>
          <ActionForm action={applyGroupAction} submit="Antrag senden" resetOnSuccess>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="g-name">Name</label><input id="g-name" name="name" type="text" required minLength={3} maxLength={80} /></div>
              <div className="field"><label htmlFor="g-cat">Kategorie</label>
                <select id="g-cat" name="category" defaultValue="Community">
                  {["Community", "Region", "Freizeit", "Beziehung", "Werte", "Events"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="g-desc">Beschreibung</label><textarea id="g-desc" name="description" required minLength={20} aria-describedby="g-desc-hint" /><p className="hint" id="g-desc-hint">Mindestens 20, höchstens 4000 Zeichen.</p></div>
            <div className="field"><label htmlFor="g-rules">Gruppenregeln (optional)</label><textarea id="g-rules" name="rules" rows={3} /></div>
            <div className="grid grid-3">
              <div className="field"><label htmlFor="g-vis">Sichtbarkeit</label>
                <select id="g-vis" name="visibility" defaultValue="open">
                  <option value="open">Offen – alle verifizierten Mitglieder lesen</option>
                  <option value="closed">Geschlossen – Beitritt nach Bestätigung</option>
                  <option value="invite">Nur auf Einladung</option>
                </select>
              </div>
              <div className="field"><label htmlFor="g-country">Land (optional)</label>
                <select id="g-country" name="regionCountry" defaultValue=""><option value="">Überregional</option>{EUROPE.map((c) => <option key={c.code} value={c.code}>{c.nameDe}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="g-region">Region (optional)</label><input id="g-region" name="regionName" type="text" maxLength={80} /></div>
            </div>
            <div className="field"><label htmlFor="g-mods">Vorgeschlagene Moderation (Pseudonyme, kommagetrennt, optional)</label><input id="g-mods" name="moderators" type="text" /></div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
