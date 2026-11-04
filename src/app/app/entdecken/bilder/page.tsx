import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { nextImageCandidate } from "@/server/discover";
import { mutualLikes } from "@/server/contacts";
import { Avatar, Empty, VerifiedBadge } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { likeAction } from "@/app/actions/member/contacts";
import { PROFILE_TYPE_LABEL } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Bildentdeckung" };

export default async function Bilder() {
  const { userId, profileId } = await actingProfile();
  const [c, mutual] = await Promise.all([nextImageCandidate(userId, profileId), mutualLikes(userId, profileId)]);
  return (
    <div className="stack narrow" style={{ width: "min(640px, 100%)" }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Bildentdeckung</h1>
        <Link className="btn ghost small" href="/app/entdecken">Zur Liste</Link>
      </div>
      <p className="alert info" style={{ margin: 0 }}>
        Ein Like ist nur ein stilles Zeichen. Es gibt keinen Kontakt frei und niemand kann dir dadurch schreiben. Gegenseitige Likes zeigen wir dir als Vorschlag – den Kontakt startest du wie gewohnt mit einer Kontaktanfrage.
      </p>
      {!c ? (
        <Empty title="Du hast alle Profile gesehen">Schau später wieder vorbei – oder entdecke Profile in der <Link href="/app/entdecken">Liste</Link>.</Empty>
      ) : (
        <article className="card stack" aria-labelledby="cand-h">
          {c.imageIds.length > 0 ? (
            <div className="grid grid-2">
              {c.imageIds.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={`/app/medien/${id}`} alt={`Freigegebenes Profilbild von ${c.handle}`} style={{ width: "100%", borderRadius: 12, aspectRatio: "3 / 4", objectFit: "cover", background: "var(--bg-elev-2)" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", placeItems: "center", padding: "32px 0", background: "var(--bg-elev-2)", borderRadius: 12 }}>
              <Avatar name={c.handle} size="lg" />
              <p className="dim" style={{ margin: "8px 0 0" }}>Noch kein freigegebenes Profilbild</p>
            </div>
          )}
          <div>
            <h2 id="cand-h" style={{ margin: 0 }}>{c.handle}</h2>
            <div className="muted">{PROFILE_TYPE_LABEL[c.type]}{c.ages.length ? ` · ${c.ages.join(" & ")}` : ""}{c.region ? ` · ${c.region}` : ""}</div>
          </div>
          <VerifiedBadge verified={c.verified} />
          {c.headline && <p style={{ margin: 0 }}>{c.headline}</p>}
          <div className="row">
            <HiddenForm action={likeAction} fields={{ targetId: c.id, value: "pass" }} submit="Weiter" submitClass="btn secondary" />
            <HiddenForm action={likeAction} fields={{ targetId: c.id, value: "like" }} submit="♥ Like" submitClass="btn" />
            <Link className="btn ghost" href={`/app/profil/${encodeURIComponent(c.handle)}`}>Profil ansehen</Link>
          </div>
        </article>
      )}
      <section aria-labelledby="mutual-h" className="stack">
        <h2 id="mutual-h">Gegenseitiges Interesse</h2>
        {mutual.length === 0 ? (
          <p className="muted">Noch keine gegenseitigen Likes.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {mutual.map((m) => (
              <li key={m.id} className="card tight row between">
                <span className="row"><Avatar name={m.handle} /> <strong>{m.handle}</strong> <VerifiedBadge verified={m.verifiedBadge} /></span>
                <Link className="btn small" href={`/app/profil/${encodeURIComponent(m.handle)}`}>Profil & Kontaktanfrage</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
