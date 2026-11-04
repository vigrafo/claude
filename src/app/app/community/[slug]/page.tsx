import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { getVisibleGroup, listThreads } from "@/server/community";
import { listGroupGallery } from "@/server/media";
import { isGroupModerator } from "@/server/rbac";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { Empty, Gate, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm, ReportForm } from "@/app/app/_components/forms";
import { uploadGroupPhotoAction } from "@/app/actions/member/media";
import {
  createThreadAction, joinGroupAction, leaveGroupAction, moderateMemberAction, moderatorApplyAction,
} from "@/app/actions/member/community";

export const metadata: Metadata = { title: "Gruppe" };

export default async function Gruppe({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId, profileId, v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return <Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />;
  let data;
  try {
    data = await getVisibleGroup(profileId, slug);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { group: g, membership } = data;
  const isMember = membership?.status === "active";
  const canRead = g.visibility === "open" || isMember;
  const category = await db.forumCategory.findFirst({ where: { groupId: g.id }, orderBy: { sort: "asc" } });
  const [threads, isMod, openApp] = await Promise.all([
    canRead && category ? listThreads(userId, profileId, category.id) : Promise.resolve([]),
    isGroupModerator(userId, g.id),
    db.groupModeratorApplication.findUnique({ where: { openKey: `${g.id}:${userId}` } }),
  ]);
  const members = isMember
    ? await db.groupMembership.findMany({ where: { groupId: g.id, status: "active", profile: { status: "active" } }, include: { profile: { select: { handle: true } } }, orderBy: { createdAt: "asc" }, take: 200 })
    : [];
  const pending = isMod ? await db.groupMembership.findMany({ where: { groupId: g.id, status: "pending" }, include: { profile: { select: { handle: true } } } }) : [];
  const gallery = v.can("group_gallery");
  const galleryItems = gallery.allowed && isMember ? await listGroupGallery(userId, profileId, g.id).catch(() => []) : [];

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <Link href="/app/community" className="dim">← Community</Link>
          <h1 style={{ margin: "4px 0 0" }}>{g.name}</h1>
          <div className="row" style={{ marginTop: 6 }}>
            {g.official && <span className="badge plan">Offiziell</span>}
            <span className="badge neutral">{g.category}</span>
            <span className="badge neutral">{g.visibility === "open" ? "Offen" : g.visibility === "closed" ? "Geschlossen" : "Auf Einladung"}</span>
            {isMod && <span className="badge verified">Du moderierst</span>}
          </div>
        </div>
        <div className="row">
          {isMember ? (
            <HiddenForm action={leaveGroupAction} fields={{ groupId: g.id }} submit="Gruppe verlassen" confirm="Gruppe wirklich verlassen?" />
          ) : membership?.status === "pending" ? (
            <span className="badge unverified">Beitritt angefragt</span>
          ) : g.visibility !== "invite" ? (
            <HiddenForm action={joinGroupAction} fields={{ groupId: g.id }} submit={g.visibility === "open" ? "Beitreten" : "Beitritt anfragen"} submitClass="btn" />
          ) : null}
          <ReportForm targetType="group" targetId={g.id} />
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="desc-h">
          <h2 id="desc-h">Worum es geht</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{g.description}</p>
          {g.rules && (<><h3>Regeln</h3><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{g.rules}</p></>)}
        </section>
        <section className="card" aria-labelledby="mem-h">
          <h2 id="mem-h">Mitglieder</h2>
          {isMember ? (
            members.length ? <div className="chips">{members.map((m) => <span key={m.id} className="chip">{m.profile.handle}{!m.canWrite ? " (stumm)" : ""}</span>)}</div> : <p className="muted">Noch keine Mitglieder.</p>
          ) : <p className="muted" style={{ margin: 0 }}>Die Mitgliederliste sehen nur Gruppenmitglieder.</p>}
        </section>
      </div>

      {isMod && (
        <section className="card stack" aria-labelledby="mod-h">
          <h2 id="mod-h">Moderation</h2>
          <h3>Offene Beitrittsanfragen</h3>
          {pending.length === 0 ? <p className="muted" style={{ margin: 0 }}>Keine offenen Anfragen.</p> : pending.map((m) => (
            <div key={m.id} className="row between card tight">
              <span>{m.profile.handle}</span>
              <span className="row">
                <HiddenForm action={moderateMemberAction} fields={{ groupId: g.id, targetProfileId: m.profileId, action: "approve" }} submit="Bestätigen" submitClass="btn small" />
                <HiddenForm action={moderateMemberAction} fields={{ groupId: g.id, targetProfileId: m.profileId, action: "remove" }} submit="Ablehnen" />
              </span>
            </div>
          ))}
          <h3>Schreibrecht</h3>
          {members.filter((m) => m.profileId !== profileId).length === 0 ? <p className="muted" style={{ margin: 0 }}>Keine weiteren Mitglieder.</p> : members.filter((m) => m.profileId !== profileId).map((m) => (
            <div key={m.id} className="row between card tight">
              <span>{m.profile.handle}{!m.canWrite && <span className="badge unverified" style={{ marginLeft: 6 }}>stumm</span>}</span>
              <HiddenForm action={moderateMemberAction} fields={{ groupId: g.id, targetProfileId: m.profileId, action: m.canWrite ? "mute" : "unmute" }} submit={m.canWrite ? "Stummschalten" : "Schreibrecht zurückgeben"} />
            </div>
          ))}
        </section>
      )}

      <section className="stack" aria-labelledby="forum-h">
        <h2 id="forum-h">Forum</h2>
        {!canRead ? (
          <p className="alert info">Die Beiträge dieser Gruppe sehen nur Mitglieder.</p>
        ) : threads.length === 0 ? (
          <Empty title="Noch keine Themen">Starte das erste Thema.</Empty>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/app/community/thema/${t.id}`} className="card card-link tight">
                  <strong>{t.pinned ? "📌 " : ""}{t.locked ? "🔒 " : ""}{t.title}</strong>
                  <div className="dim" style={{ fontSize: "0.85rem" }}>{t.official ? "eropub" : t.author?.handle ?? "gelöschtes Profil"} · {t._count.posts} {t._count.posts === 1 ? "Beitrag" : "Beiträge"} · zuletzt {formatDate(t.lastPostAt, true)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isMember && category && (membership?.canWrite ? (
          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Neues Thema starten</summary>
            <div style={{ marginTop: 12 }}>
              <ActionForm action={createThreadAction} submit="Thema veröffentlichen">
                <input type="hidden" name="categoryId" value={category.id} />
                <div className="field"><label htmlFor="t-title">Titel</label><input id="t-title" name="title" type="text" required minLength={4} /></div>
                <div className="field"><label htmlFor="t-body">Text</label><textarea id="t-body" name="body" required rows={6} /></div>
              </ActionForm>
            </div>
          </details>
        ) : <p className="alert warn">Dein Schreibrecht in dieser Gruppe ist derzeit eingeschränkt.</p>)}
        {!isMember && canRead && <p className="muted">Tritt der Gruppe bei, um mitzuschreiben.</p>}
      </section>

      {isMember && (
        <section className="card stack" aria-labelledby="gal-h">
          <h2 id="gal-h">Gruppengalerie</h2>
          {!gallery.allowed ? (
            <p className="muted" style={{ margin: 0 }}>{gallery.reason} <Link href="/app/konto/tarif">Tarife ansehen</Link></p>
          ) : galleryItems.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Noch keine freigegebenen Bilder in dieser Gruppe.</p>
          ) : null}
          {gallery.allowed && (
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>Bild zur Gruppengalerie hinzufügen</summary>
              <ActionForm action={uploadGroupPhotoAction} submit="Hochladen" resetOnSuccess>
                <input type="hidden" name="groupId" value={g.id} />
                <input type="hidden" name="slug" value={g.slug} />
                <div className="field">
                  <label htmlFor="gfile">Bilddatei (JPEG, PNG, WebP)</label>
                  <input id="gfile" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
                  <p className="hint">Metadaten werden entfernt. Das Bild erscheint nach der Prüfung für aktive Gruppenmitglieder mit Premium oder Gold.</p>
                </div>
                <label className="check field"><input type="checkbox" name="rights" required /> Ich habe die Rechte am Bild; alle erkennbaren Personen sind volljährig und einverstanden.</label>
              </ActionForm>
            </details>
          )}
          {galleryItems.length > 0 && (
            <div className="grid grid-4">
              {galleryItems.map((m) => (
                <figure key={m.id} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/app/medien/${m.id}`} alt={`Bild von ${m.owner.handle}`} style={{ width: "100%", borderRadius: 10, aspectRatio: "1", objectFit: "cover", background: "var(--bg-elev-2)" }} />
                  <figcaption className="dim" style={{ fontSize: "0.8rem" }}>{m.owner.handle}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {isMember && !isMod && (
        <section className="card stack" aria-labelledby="modapp-h">
          <h2 id="modapp-h">Moderation unterstützen</h2>
          {openApp ? (
            <p className="alert info" style={{ margin: 0 }}>Bewerbung offen – das eropub-Team entscheidet über die Ernennung.</p>
          ) : (
            <ActionForm action={moderatorApplyAction} submit="Bewerbung senden" submitClass="btn secondary">
              <input type="hidden" name="groupId" value={g.id} />
              <div className="field">
                <label htmlFor="motivation">Deine Motivation</label>
                <textarea id="motivation" name="motivation" required minLength={30} rows={4} aria-describedby="mot-hint" />
                <p className="hint" id="mot-hint">Mindestens 30 Zeichen. Die Rolle gilt nur für dich und nur für diese Gruppe.</p>
              </div>
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}
