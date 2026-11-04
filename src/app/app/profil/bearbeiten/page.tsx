import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { ActionForm } from "@/components/ActionForm";
import { updateProfileAction } from "@/app/actions/member/profile";
import { RegionPicker } from "@/app/app/_components/RegionPicker";
import { EUROPE } from "@/domain/countries";
import { LOOKING_FOR, RELATIONSHIP_FORMS } from "@/app/app/_lib/options";
import type { ContactFilter } from "@/domain/access";

export const metadata: Metadata = { title: "Profil bearbeiten" };

interface Privacy { invisibleOnline?: boolean; readReceipts?: boolean; neutralNotifications?: boolean; discreetMode?: boolean }

export default async function Bearbeiten() {
  const { v, profileId } = await actingProfile();
  const p = v.profileRow;
  const [interests, mine, regions] = await Promise.all([
    db.interest.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { label: "asc" }] }),
    db.profileInterest.findMany({ where: { profileId }, include: { interest: true } }),
    db.region.findMany({ orderBy: { name: "asc" } }),
  ]);
  const mySlugs = new Set(mine.map((m) => m.interest.slug));
  const filter = (p.contactFilter ?? {}) as ContactFilter;
  const privacy = (p.privacy ?? {}) as Privacy;
  const role = v.memberships.find((m) => m.profileId === profileId)?.role;
  const ownBirthYear = role === "partner" ? p.birthYearB : p.birthYearA;
  const year = new Date().getFullYear();
  const categories = [...new Set(interests.map((i) => i.category))];
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Profil bearbeiten</h1>
        <Link className="btn ghost small" href="/app/profil">Zurück</Link>
      </div>
      <ActionForm action={updateProfileAction} submit="Profil speichern" className="stack">
        <section className="card">
          <h2>Über {p.type === "couple" ? "euch" : "dich"}</h2>
          <div className="field">
            <label htmlFor="headline">Überschrift</label>
            <input id="headline" name="headline" type="text" defaultValue={p.headline ?? ""} aria-describedby="headline-hint" />
            <p className="hint" id="headline-hint">Höchstens 120 Zeichen. Bitte nicht explizit.</p>
          </div>
          <div className="field">
            <label htmlFor="about">Beschreibung</label>
            <textarea id="about" name="about" rows={6} defaultValue={p.about ?? ""} aria-describedby="about-hint" />
            <p className="hint" id="about-hint">Höchstens 2000 Zeichen – längere Texte werden nicht gekürzt, sondern abgewiesen.</p>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="relationshipForm">Beziehungsform</label>
              <select id="relationshipForm" name="relationshipForm" defaultValue={p.relationshipForm ?? ""}>
                {RELATIONSHIP_FORMS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            {ownBirthYear == null && (
              <div className="field">
                <label htmlFor="birthYear">Dein Geburtsjahr</label>
                <input id="birthYear" name="birthYear" type="number" min={year - 110} max={year - 18} inputMode="numeric" aria-describedby="by-hint" />
                <p className="hint" id="by-hint">Nur das Jahr, für die Altersanzeige. Einmalig – Änderungen danach nur über den Support.</p>
              </div>
            )}
          </div>
          <fieldset>
            <legend>{p.type === "couple" ? "Wir suchen" : "Ich suche"}</legend>
            <div className="grid grid-3" style={{ gap: 4 }}>
              {LOOKING_FOR.map((l) => (
                <label key={l.key} className="check"><input type="checkbox" name="lookingFor" value={l.key} defaultChecked={p.lookingFor.includes(l.key)} /> {l.label}</label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card">
          <h2>Interessen</h2>
          <p className="hint">Interessen sehen nur verifizierte Mitglieder und deine Kontakte.</p>
          {categories.map((cat) => (
            <fieldset key={cat}>
              <legend>{cat}</legend>
              <div className="grid grid-3" style={{ gap: 4 }}>
                {interests.filter((i) => i.category === cat).map((i) => (
                  <label key={i.slug} className="check"><input type="checkbox" name="interests" value={i.slug} defaultChecked={mySlugs.has(i.slug)} /> {i.label}</label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>

        <section className="card">
          <RegionPicker
            countries={EUROPE.map((c) => ({ code: c.code, nameDe: c.nameDe }))}
            regions={regions.map((r) => ({ countryCode: r.countryCode, name: r.name, cities: r.cities }))}
            defaults={{ country: p.regionCountry ?? "DE", region: p.regionName ?? "", city: p.regionCity ?? "", postal: p.postalPrefix ?? "" }}
          />
          <p className="hint" style={{ margin: 0 }}>Russland und Belarus sind als Standorte nicht verfügbar.</p>
        </section>

        <section className="card">
          <h2>Kontaktfilter</h2>
          <p className="hint">Wer dir Kontaktanfragen und Nachrichten senden darf. Der Filter gilt immer – auch für zahlende Mitglieder.</p>
          <fieldset>
            <legend>Erlaubte Profiltypen</legend>
            <label className="check"><input type="checkbox" name="allowTypes" value="single" defaultChecked={!filter.allowTypes?.length || filter.allowTypes.includes("single")} /> Einzelprofile</label>
            <label className="check"><input type="checkbox" name="allowTypes" value="couple" defaultChecked={!filter.allowTypes?.length || filter.allowTypes.includes("couple")} /> Paare</label>
            <label className="check"><input type="checkbox" name="allowTypes" value="organizer" defaultChecked={!filter.allowTypes?.length || filter.allowTypes.includes("organizer")} /> Veranstalter</label>
          </fieldset>
          <label className="check field"><input type="checkbox" name="verifiedOnly" defaultChecked={!!filter.verifiedOnly} /> Nur verifizierte Profile</label>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="minAge">Mindestalter</label>
              <input id="minAge" name="minAge" type="number" min={18} max={110} inputMode="numeric" defaultValue={filter.minAge ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="maxAge">Höchstalter</label>
              <input id="maxAge" name="maxAge" type="number" min={18} max={110} inputMode="numeric" defaultValue={filter.maxAge ?? ""} />
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Privatsphäre</h2>
          <label className="check field"><input type="checkbox" name="invisibleOnline" defaultChecked={!!privacy.invisibleOnline} /> Online-Status verbergen</label>
          <label className="check field"><input type="checkbox" name="readReceipts" defaultChecked={privacy.readReceipts !== false} /> Lesebestätigungen senden</label>
          <label className="check field"><input type="checkbox" name="neutralNotifications" defaultChecked={privacy.neutralNotifications !== false} /> Neutrale Benachrichtigungen (ohne Namen oder Inhalte)</label>
          <label className="check field"><input type="checkbox" name="discreetMode" defaultChecked={!!privacy.discreetMode} aria-describedby="discreet-hint" /> Diskreter Modus</label>
          <p className="hint" id="discreet-hint">
            Der diskrete Modus hält Anzeigen und Benachrichtigungen unauffällig. Ehrlicher Hinweis: Er kann den Verlauf deines Browsers oder Geräts nicht löschen oder verbergen – nutze dafür z. B. ein privates Fenster.
          </p>
        </section>
      </ActionForm>
    </div>
  );
}
