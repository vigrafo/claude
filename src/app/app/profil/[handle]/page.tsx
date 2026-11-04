import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { getProfileForViewer } from "@/server/discover";
import { AppError } from "@/server/errors";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { HiddenForm, ReportForm } from "@/app/app/_components/forms";
import { ActionForm } from "@/components/ActionForm";
import { blockAction, respondContactAction, sendContactRequestAction, toggleFavoriteAction } from "@/app/actions/member/contacts";
import { inviteGameAction } from "@/app/actions/member/games";
import { startCallAction } from "@/app/actions/member/calls";
import { GAME_VARIANTS } from "@/domain/games";
import { PROFILE_TYPE_LABEL, relationshipLabel } from "@/app/app/_lib/options";
import { livekitConfigured } from "@/server/calls";
import { listVisibleGallery, visibleProfilePhotos } from "@/server/uploads";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilDetail({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { userId, profileId, v } = await actingProfile();
  let p;
  try {
    p = await getProfileForViewer(userId, profileId, decodeURIComponent(handle));
  } catch (e) {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const send = v.can("send_message");
  const calls = v.can("calls");
  const canInviteGame = v.profileRow.type === "couple" && p.type === "couple" && !p.isSelf;
  const games = v.can("games");
  const [photos, gallery] = await Promise.all([visibleProfilePhotos(profileId, [p.id]), p.isSelf ? Promise.resolve([]) : listVisibleGallery(profileId, p.id)]);
  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: "flex-start", gap: 20 }}>
        <Avatar name={p.handle} size="lg" photoId={photos.get(p.id)} />
        <div className="stack" style={{ flex: 1, minWidth: 220 }}>
          <div>
            <h1 style={{ margin: 0 }}>{p.handle}</h1>
            <div className="muted">
              {PROFILE_TYPE_LABEL[p.type]}{p.ages.length ? ` · ${p.ages.join(" & ")} Jahre` : ""}{p.labels.length > 1 ? ` · ${p.labels.join(" & ")}` : ""}
            </div>
          </div>
          <div className="row">
            <VerifiedBadge verified={p.verified} />
            {p.connected && !p.isSelf && <span className="badge neutral">Verbunden</span>}
            {p.region && <span className="badge neutral">{p.region}</span>}
          </div>
          {p.headline && <p style={{ margin: 0, fontSize: "1.1rem" }}>{p.headline}</p>}
        </div>
      </div>

      {p.isSelf ? (
        <div className="alert info">Das ist dein eigenes Profil – so sehen es andere Mitglieder. <Link href="/app/profil/bearbeiten">Bearbeiten</Link></div>
      ) : (
        <section className="card stack" aria-labelledby="actions-h">
          <h2 id="actions-h" className="sr-only">Aktionen</h2>
          <div className="row" style={{ alignItems: "flex-start" }}>
            {p.connected ? null : p.pendingIncomingId ? (
              <HiddenForm action={respondContactAction} fields={{ requestId: p.pendingIncomingId, accept: "1" }} submit="Kontaktanfrage annehmen" submitClass="btn" />
            ) : p.pendingOutgoing ? (
              <span className="badge neutral" style={{ alignSelf: "center" }}>Kontaktanfrage gesendet</span>
            ) : (
              <HiddenForm action={sendContactRequestAction} fields={{ targetId: p.id }} submit="Kontaktanfrage senden" submitClass="btn" />
            )}
            <Link className="btn secondary" href={p.conversationId ? `/app/nachrichten/${p.conversationId}` : `/app/nachrichten/neu?an=${encodeURIComponent(p.handle)}`}>
              Nachricht schreiben
            </Link>
            <HiddenForm action={toggleFavoriteAction} fields={{ targetId: p.id }} submit={p.isFavorite ? "★ Favorit" : "☆ Merken"} submitClass="btn ghost" />
          </div>
          {!p.connected && !p.conversationId && (
            <p className="hint" style={{ margin: 0 }}>
              Deine erste Nachricht an ein Profil, mit dem du noch nicht verbunden bist, ist eine Nachrichtenanfrage. Weitere Nachrichten sind erst nach Annahme möglich.
              {send.tokenCostPerMessage ? ` Mit Basis kostet jede Nachricht ${send.tokenCostPerMessage} Token.` : " Mit deinem Tarif schreibst du ohne Tokenkosten."}
            </p>
          )}
          {calls.allowed && p.connected && livekitConfigured() && (
            <div className="row">
              <HiddenForm action={startCallAction} fields={{ targetId: p.id, mode: "audio" }} submit="📞 Audioanruf" />
              <HiddenForm action={startCallAction} fields={{ targetId: p.id, mode: "video" }} submit="🎥 Videoanruf" />
              <Link className="btn ghost small" href="/app/anrufe">Zu den Anrufen</Link>
            </div>
          )}
          {canInviteGame && (
            <details>
              <summary className="btn ghost small">Zum Kennenlernspiel einladen</summary>
              <div className="card tight" style={{ marginTop: 8 }}>
                {games.allowed ? (
                  <ActionForm action={inviteGameAction} submit="Einladung senden" submitClass="btn small">
                    <input type="hidden" name="handle" value={p.handle} />
                    <fieldset>
                      <legend>Variante</legend>
                      {Object.entries(GAME_VARIANTS).map(([k, g], i) => (
                        <label key={k} className="check"><input type="radio" name="variant" value={k} defaultChecked={i === 0} /> <span><strong>{g.title}</strong> – {g.description}</span></label>
                      ))}
                    </fieldset>
                  </ActionForm>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>{games.reason} <Link href="/app/verifizierung">Zur Verifizierung</Link></p>
                )}
              </div>
            </details>
          )}
          <div className="row">
            <HiddenForm action={blockAction} fields={{ targetId: p.id }} submit="Blockieren" submitClass="btn danger small" confirm={`${p.handle} wirklich blockieren? Ihr könnt euch dann nicht mehr sehen oder schreiben.`} />
            <ReportForm targetType="profile" targetId={p.id} />
          </div>
        </section>
      )}

      <div className="grid grid-2">
        {gallery.length > 0 && (
          <section className="card" aria-labelledby="gal-h">
            <h2 id="gal-h">Galerie</h2>
            <div className="photo-grid">
              {gallery.map((g, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={g.id} src={`/app/medien/${g.id}`} alt={`Galeriebild ${i + 1} von ${p.handle}`} loading="lazy" />
              ))}
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>Du siehst nur Bilder, die {p.handle} für dich freigegeben hat.</p>
          </section>
        )}
        <section className="card" aria-labelledby="about-h">
          <h2 id="about-h">Über {p.type === "couple" ? "uns" : "mich"}</h2>
          {p.about ? <p style={{ whiteSpace: "pre-wrap" }}>{p.about}</p> : <p className="muted">Noch keine Beschreibung.</p>}
          {relationshipLabel(p.relationshipForm) && <p className="muted" style={{ margin: 0 }}>Beziehungsform: {relationshipLabel(p.relationshipForm)}</p>}
        </section>
        <section className="card stack" aria-labelledby="int-h">
          <h2 id="int-h">Interessen</h2>
          {p.interests.length ? (
            <div className="chips">{p.interests.map((i) => <span key={i} className="chip">{i}</span>)}</div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{p.isSelf ? "Noch keine Interessen gewählt." : "Keine sichtbaren Interessen. Manche Angaben sehen nur verifizierte Mitglieder oder Kontakte."}</p>
          )}
          {p.lookingFor.length > 0 && (
            <>
              <h3>Sucht</h3>
              <div className="chips">{p.lookingFor.map((i) => <span key={i} className="chip on">{i}</span>)}</div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
