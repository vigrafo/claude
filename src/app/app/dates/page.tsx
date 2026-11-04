import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { RADIUS_OPTIONS, coarsePostalDisplay, listOwnDates, searchDates } from "@/server/dates";
import { getSetting } from "@/server/settings";
import { Empty, Gate, VerifiedBadge, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm, ReportForm } from "@/app/app/_components/forms";
import { closeDateAction, createDateAction } from "@/app/actions/member/dates";
import { EUROPE, isAllowedCountry } from "@/domain/countries";

export const metadata: Metadata = { title: "Dates" };

export default async function Dates({ searchParams }: { searchParams: Promise<{ land?: string; plz?: string; radius?: string }> }) {
  const sp = await searchParams;
  const { userId, profileId, v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return (<div className="stack"><h1>Dates</h1><Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} /></div>);
  const features = await getSetting("features");
  if (!features.datesEnabled) return (<div className="stack"><h1>Dates</h1><p className="alert info">Dates sind derzeit pausiert.</p></div>);
  const country = sp.land && isAllowedCountry(sp.land) ? sp.land.toUpperCase() : v.profileRow.regionCountry ?? "DE";
  const radius = RADIUS_OPTIONS.find((r) => String(r) === sp.radius) ?? 50;
  const plz = (sp.plz ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  const [results, own] = await Promise.all([
    searchDates(userId, profileId, { country, postalCode: plz, radiusKm: radius }),
    listOwnDates(userId, profileId),
  ]);
  const others = results.filter((d) => d.profileId !== profileId);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Dates</h1>
      <form method="get" className="card" role="search" aria-label="Dates suchen">
        <div className="grid grid-4">
          <div className="field"><label htmlFor="land">Land</label>
            <select id="land" name="land" defaultValue={country}>{EUROPE.map((x) => <option key={x.code} value={x.code}>{x.nameDe}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="plz">Postleitzahl</label><input id="plz" name="plz" type="text" inputMode="numeric" defaultValue={plz} /></div>
          <div className="field"><label htmlFor="radius">Umkreis</label>
            <select id="radius" name="radius" defaultValue={String(radius)}>{RADIUS_OPTIONS.map((r) => <option key={r} value={r}>{r >= 1000 ? "ganzes Land" : `ca. ${r} km`}</option>)}</select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}><button className="btn" type="submit">Suchen</button></div>
        </div>
        <p className="hint" style={{ margin: 0 }}>Der Umkreis ist eine grobe Näherung über die ersten Stellen der Postleitzahl – keine exakte Entfernungsmessung.</p>
      </form>

      <section className="stack" aria-labelledby="res-h">
        <h2 id="res-h">Offene Dates</h2>
        {others.length === 0 ? <Empty title="Keine Dates gefunden">Vergrößere den Umkreis oder biete selbst ein Date an.</Empty> : (
          <div className="grid grid-2">
            {others.map((d) => (
              <article key={d.id} className="card stack">
                <div className="row between">
                  <span className="badge neutral">{d.kind === "group" ? `Gruppen-Date${d.maxPeople ? ` · bis ${d.maxPeople}` : ""}` : "Persönliches Date"}</span>
                  <span className="dim">{d.when ? formatDate(d.when, true) : "Termin nach Absprache"}</span>
                </div>
                <h3 style={{ margin: 0 }}>{d.title}</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{d.description}</p>
                {d.preferences.length > 0 && <div className="chips">{d.preferences.map((p) => <span key={p} className="chip">{p}</span>)}</div>}
                <div className="row between">
                  <span className="row">PLZ {coarsePostalDisplay(d.postalCode)} · <Link href={`/app/profil/${encodeURIComponent(d.profile.handle)}`}>{d.profile.handle}</Link> <VerifiedBadge verified={d.profile.verifiedBadge} /></span>
                  <Link className="btn small" href={`/app/nachrichten/neu?an=${encodeURIComponent(d.profile.handle)}`}>Interesse zeigen</Link>
                </div>
                <ReportForm targetType="date" targetId={d.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Date anbieten</summary>
        <div style={{ marginTop: 12 }}>
          <ActionForm action={createDateAction} submit="Date veröffentlichen" resetOnSuccess>
            <fieldset>
              <legend>Art</legend>
              <label className="check"><input type="radio" name="kind" value="personal" defaultChecked /> Persönliches Date</label>
              <label className="check"><input type="radio" name="kind" value="group" /> Gruppen-Date</label>
            </fieldset>
            <div className="field"><label htmlFor="d-title">Titel</label><input id="d-title" name="title" type="text" required minLength={4} maxLength={120} /></div>
            <div className="field"><label htmlFor="d-desc">Beschreibung</label><textarea id="d-desc" name="description" required rows={4} aria-describedby="d-desc-hint" /><p className="hint" id="d-desc-hint">10 bis 2000 Zeichen. Bitte nicht explizit und ohne genaue Adresse.</p></div>
            <div className="grid grid-3">
              <div className="field"><label htmlFor="d-postal">Postleitzahl</label><input id="d-postal" name="postalCode" type="text" required inputMode="numeric" aria-describedby="d-postal-hint" /><p className="hint" id="d-postal-hint">Andere sehen nur die ersten Stellen.</p></div>
              <div className="field"><label htmlFor="d-country">Land</label><select id="d-country" name="country" defaultValue={country}>{EUROPE.map((x) => <option key={x.code} value={x.code}>{x.nameDe}</option>)}</select></div>
              <div className="field"><label htmlFor="d-when">Termin (optional)</label><input id="d-when" name="when" type="datetime-local" /></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="d-prefs">Wünsche (optional, kommagetrennt)</label><input id="d-prefs" name="preferences" type="text" placeholder="z. B. Café, Spaziergang, Weinbar" /></div>
              <div className="field"><label htmlFor="d-max">Max. Personen (nur Gruppen-Date)</label><input id="d-max" name="maxPeople" type="number" min={3} max={50} inputMode="numeric" /></div>
            </div>
          </ActionForm>
        </div>
      </details>

      <section className="stack" aria-labelledby="own-h">
        <h2 id="own-h">Deine Dates</h2>
        {own.length === 0 ? <p className="muted">Du hast noch keine Dates angeboten.</p> : own.map((d) => (
          <div key={d.id} className="card tight row between">
            <span><strong>{d.title}</strong> <span className="dim">· {d.when ? formatDate(d.when, true) : "nach Absprache"} · PLZ {d.postalCode}</span></span>
            {d.status === "open" ? <HiddenForm action={closeDateAction} fields={{ dateId: d.id }} submit="Schließen" confirm="Date schließen?" /> : <span className="badge neutral">Geschlossen</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
