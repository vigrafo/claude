"use client";
import { useState } from "react";

/** Land → Region (Katalog + Freitext) → Stadt (Vorschläge + Freitext). Keine genaue Adresse. */
export function RegionPicker({
  countries, regions, defaults,
}: {
  countries: { code: string; nameDe: string }[];
  regions: { countryCode: string; name: string; cities: string[] }[];
  defaults: { country: string; region: string; city: string; postal: string };
}) {
  const [country, setCountry] = useState(defaults.country);
  const [region, setRegion] = useState(defaults.region);
  const forCountry = regions.filter((r) => r.countryCode === country);
  const cities = forCountry.find((r) => r.name === region)?.cities ?? forCountry.flatMap((r) => r.cities);
  return (
    <fieldset>
      <legend>Region</legend>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="country">Land</label>
          <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.nameDe}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="regionName">Region / Bundesland</label>
          <input id="regionName" name="regionName" type="text" list="region-list" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={80} aria-describedby="region-hint" />
          <datalist id="region-list">{forCountry.map((r) => <option key={r.name} value={r.name} />)}</datalist>
          <p className="hint" id="region-hint">{forCountry.length ? "Aus der Liste wählen oder frei eingeben." : "Für dieses Land gibt es noch keine Liste – bitte frei eingeben."}</p>
        </div>
        <div className="field">
          <label htmlFor="regionCity">Stadt (optional)</label>
          <input id="regionCity" name="regionCity" type="text" list="city-list" defaultValue={defaults.city} maxLength={80} />
          <datalist id="city-list">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="postal">Postleitzahl (optional)</label>
          <input id="postal" name="postal" type="text" inputMode="numeric" defaultValue={defaults.postal} maxLength={10} aria-describedby="postal-hint" />
          <p className="hint" id="postal-hint">Wir speichern nur die ersten 2 Stellen – für grobe Entfernungen, nie eine genaue Lage.</p>
        </div>
      </div>
    </fieldset>
  );
}
