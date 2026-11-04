import Link from "next/link";
import { visibleProfilePhotos } from "@/server/uploads";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { discoverProfiles, type DiscoverFilters } from "@/server/discover";
import { db } from "@/server/db";
import { Avatar, Empty, VerifiedBadge } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { toggleFavoriteAction } from "@/app/actions/member/contacts";
import { PROFILE_TYPE_LABEL } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Entdecken" };

type SP = { typ?: string; min?: string; max?: string; km?: string; i?: string | string[]; v?: string };

function num(s: string | undefined, lo: number, hi: number): number | undefined {
  const n = Number.parseInt(s ?? "", 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
}

export default async function Entdecken({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { userId, profileId, v } = await actingProfile();
  const interestsSel = (Array.isArray(sp.i) ? sp.i : sp.i ? [sp.i] : []).slice(0, 10);
  const f: DiscoverFilters = {
    type: sp.typ === "single" || sp.typ === "couple" ? sp.typ : undefined,
    minAge: num(sp.min, 18, 110), maxAge: num(sp.max, 18, 110), maxDistanceKm: num(sp.km, 1, 1000),
    interests: interestsSel, verifiedOnly: sp.v === "1",
  };
  const [items, interests] = await Promise.all([
    discoverProfiles(userId, profileId, f),
    db.interest.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { label: "asc" }] }),
  ]);
  const photos = await visibleProfilePhotos(profileId, items.map((x) => x.id));
  const noCoords = v.profileRow.lat == null;
  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Entdecken</h1>
        <Link className="btn secondary" href="/app/entdecken/bilder">Bildentdeckung</Link>
      </div>
      <details className="card" open={Object.keys(sp).length > 0}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Filter</summary>
        <form method="get" className="stack" style={{ marginTop: 12 }}>
          <div className="grid grid-4">
            <div className="field">
              <label htmlFor="typ">Profiltyp</label>
              <select id="typ" name="typ" defaultValue={f.type ?? ""}>
                <option value="">Alle</option>
                <option value="single">Einzelprofile</option>
                <option value="couple">Paare</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="min">Alter ab</label>
              <input id="min" name="min" type="number" min={18} max={110} inputMode="numeric" defaultValue={f.minAge ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="max">Alter bis</label>
              <input id="max" name="max" type="number" min={18} max={110} inputMode="numeric" defaultValue={f.maxAge ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="km">Entfernung</label>
              <select id="km" name="km" defaultValue={f.maxDistanceKm ? String(f.maxDistanceKm) : ""} aria-describedby="km-hint">
                <option value="">Egal</option>
                {[10, 25, 50, 100, 250].map((k) => <option key={k} value={k}>bis {k} km</option>)}
              </select>
              <p className="hint" id="km-hint">Nur grobe Stufen{noCoords ? " – für dein Profil ist noch kein grober Standort hinterlegt" : ""}.</p>
            </div>
          </div>
          <fieldset>
            <legend>Gemeinsame Interessen</legend>
            <div className="chips">
              {interests.map((it) => (
                <label key={it.slug} className="chip" style={{ margin: 0, fontWeight: 400, display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" name="i" value={it.slug} defaultChecked={interestsSel.includes(it.slug)} /> {it.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="check"><input type="checkbox" name="v" value="1" defaultChecked={f.verifiedOnly} /> Nur verifizierte Profile</label>
          <div className="row">
            <button className="btn" type="submit">Anwenden</button>
            <Link className="btn ghost" href="/app/entdecken">Zurücksetzen</Link>
          </div>
        </form>
      </details>
      <p className="muted" style={{ margin: 0 }}>
        Die Reihenfolge ergibt sich aus konkreten Gemeinsamkeiten: Interessen, was ihr sucht, grobe Nähe, Aktivität und Verifizierung. Wir zeigen keine erfundenen Prozentwerte.
      </p>
      {items.length === 0 ? (
        <Empty title="Keine passenden Profile">Passe deine Filter an oder schau später noch einmal vorbei.</Empty>
      ) : (
        <div className="grid grid-3">
          {items.map((p) => (
            <article key={p.id} className="card stack" aria-labelledby={`h-${p.id}`}>
              <div className="row">
                <Avatar name={p.handle} photoId={photos.get(p.id)} />
                <div>
                  <h2 id={`h-${p.id}`} style={{ fontSize: "1.15rem", margin: 0 }}><Link href={`/app/profil/${encodeURIComponent(p.handle)}`}>{p.handle}</Link></h2>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    {PROFILE_TYPE_LABEL[p.type]}{p.ages.length ? ` · ${p.ages.join(" & ")}` : ""}{p.distance ? ` · ${p.distance}` : ""}
                  </div>
                </div>
              </div>
              <VerifiedBadge verified={p.verified} />
              {p.headline && <p style={{ margin: 0 }}>{p.headline}</p>}
              {p.region && <p className="dim" style={{ margin: 0 }}>{p.region}</p>}
              {p.reasons.length > 0 && (
                <ul className="checks" aria-label="Warum dieses Profil">
                  {p.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              <div className="row">
                <Link className="btn small" href={`/app/profil/${encodeURIComponent(p.handle)}`}>Profil ansehen</Link>
                <HiddenForm action={toggleFavoriteAction} fields={{ targetId: p.id }} submit={p.isFavorite ? "★ Favorit" : "☆ Merken"} submitClass="btn ghost small" />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
