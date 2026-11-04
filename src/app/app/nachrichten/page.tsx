import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { blockedIds } from "@/server/discover";
import { listConnections, listContactRequests } from "@/server/contacts";
import { Avatar, Empty, VerifiedBadge, formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { respondMessageRequestAction } from "@/app/actions/member/messages";
import { endConnectionAction, respondContactAction, withdrawContactAction } from "@/app/actions/member/contacts";

export const metadata: Metadata = { title: "Nachrichten" };

const FOLDERS = [["chats", "Chats"], ["anfragen", "Anfragen"], ["kontakte", "Kontakte"]] as const;

export default async function Nachrichten({ searchParams }: { searchParams: Promise<{ ordner?: string; q?: string }> }) {
  const sp = await searchParams;
  const folder = FOLDERS.some(([k]) => k === sp.ordner) ? sp.ordner! : "chats";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const { userId, profileId } = await actingProfile();
  const blocked = await blockedIds(profileId);

  const parts = await db.conversationParticipant.findMany({
    where: { profileId },
    include: {
      conversation: {
        include: {
          request: true,
          participants: { include: { profile: { select: { id: true, handle: true, verifiedBadge: true, status: true } } } },
          messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  const rows = parts
    .map((p) => {
      const other = p.conversation.participants.find((x) => x.profileId !== profileId)?.profile;
      const last = p.conversation.messages[0];
      return { id: p.conversationId, other, last, req: p.conversation.request, unread: !!last && last.senderProfileId !== profileId && (!p.lastReadAt || last.createdAt > p.lastReadAt) };
    })
    .filter((r) => r.other && r.other.status === "active" && !blocked.has(r.other.id))
    .sort((a, b) => (b.last?.createdAt.getTime() ?? 0) - (a.last?.createdAt.getTime() ?? 0));
  const requestsToMe = rows.filter((r) => r.req?.status === "pending" && r.req.toProfileId === profileId);
  const chats = rows.filter((r) => !(r.req?.status === "pending" && r.req.toProfileId === profileId) && !(r.req?.status === "declined" && r.req.toProfileId === profileId));

  const results = q.length >= 2
    ? await db.message.findMany({
        where: { conversationId: { in: rows.map((r) => r.id) }, deletedAt: null, body: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" }, take: 50,
      })
    : [];
  const contactData = folder === "kontakte" ? await Promise.all([listContactRequests(userId, profileId), listConnections(userId, profileId)]) : null;

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Nachrichten</h1>
      <form method="get" role="search" className="row">
        <label htmlFor="q" className="sr-only">In deinen Unterhaltungen suchen</label>
        <input id="q" name="q" type="search" placeholder="In deinen Unterhaltungen suchen" defaultValue={q} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn secondary" type="submit">Suchen</button>
      </form>
      {q && (
        <section aria-labelledby="res-h" className="stack">
          <h2 id="res-h">Suchergebnisse</h2>
          {q.length < 2 ? <p className="muted">Bitte mindestens 2 Zeichen eingeben.</p> : results.length === 0 ? <p className="muted">Keine Treffer.</p> : (
            <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
              {results.map((m) => {
                const r = rows.find((x) => x.id === m.conversationId)!;
                return (
                  <li key={m.id}><Link className="card card-link tight" href={`/app/nachrichten/${m.conversationId}`}>
                    <strong>{r.other!.handle}</strong> <span className="dim">{formatDate(m.createdAt, true)}</span>
                    <div className="muted" style={{ overflowWrap: "anywhere" }}>{m.body.slice(0, 160)}</div>
                  </Link></li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      <nav className="row" aria-label="Ordner">
        {FOLDERS.map(([k, label]) => (
          <Link key={k} href={`/app/nachrichten?ordner=${k}`} className={`btn small ${folder === k ? "" : "secondary"}`} aria-current={folder === k ? "page" : undefined}>
            {label}{k === "anfragen" && requestsToMe.length > 0 ? ` (${requestsToMe.length})` : ""}
          </Link>
        ))}
      </nav>

      {folder === "chats" && (chats.length === 0 ? (
        <Empty title="Noch keine Unterhaltungen">Finde Profile unter <Link href="/app/entdecken">Entdecken</Link> und schreib die erste Nachricht.</Empty>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {chats.map((r) => (
            <li key={r.id}>
              <Link href={`/app/nachrichten/${r.id}`} className="card card-link tight row" style={{ flexWrap: "nowrap" }}>
                <Avatar name={r.other!.handle} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{r.other!.handle}</strong> {r.unread && <span className="badge-count">neu</span>}
                  {r.req?.status === "pending" && <span className="badge neutral" style={{ marginLeft: 6 }}>Anfrage offen</span>}
                  <span className="dim" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.last ? (r.last.kind === "gift" ? "🎁 Geschenk" : r.last.body) : "Keine Nachrichten"}
                  </span>
                </span>
                <span className="dim" style={{ fontSize: "0.8rem" }}>{r.last ? formatDate(r.last.createdAt) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      ))}

      {folder === "anfragen" && (requestsToMe.length === 0 ? (
        <Empty title="Keine offenen Anfragen">Hier landen erste Nachrichten von Profilen, mit denen du noch nicht verbunden bist.</Empty>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {requestsToMe.map((r) => (
            <li key={r.id} className="card stack">
              <div className="row"><Avatar name={r.other!.handle} /><strong>{r.other!.handle}</strong><VerifiedBadge verified={r.other!.verifiedBadge} /></div>
              {r.last && <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.last.kind === "gift" ? "🎁 " : ""}{r.last.body}</p>}
              <div className="row">
                <HiddenForm action={respondMessageRequestAction} fields={{ conversationId: r.id, accept: "1" }} submit="Annehmen" submitClass="btn small" />
                <HiddenForm action={respondMessageRequestAction} fields={{ conversationId: r.id, accept: "0" }} submit="Ablehnen" />
                <Link className="btn ghost small" href={`/app/nachrichten/${r.id}`}>Öffnen</Link>
                <Link className="btn ghost small" href={`/app/profil/${encodeURIComponent(r.other!.handle)}`}>Profil</Link>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {folder === "kontakte" && contactData && (
        <div className="stack">
          <section aria-labelledby="in-h" className="stack">
            <h2 id="in-h">Kontaktanfragen an dich</h2>
            {contactData[0].incoming.length === 0 ? <p className="muted">Keine offenen Kontaktanfragen.</p> : contactData[0].incoming.map((r) => (
              <div key={r.id} className="card tight row between">
                <span className="row"><Avatar name={r.from.handle} /><Link href={`/app/profil/${encodeURIComponent(r.from.handle)}`}>{r.from.handle}</Link><VerifiedBadge verified={r.from.verifiedBadge} /></span>
                <span className="row">
                  <HiddenForm action={respondContactAction} fields={{ requestId: r.id, accept: "1" }} submit="Annehmen" submitClass="btn small" />
                  <HiddenForm action={respondContactAction} fields={{ requestId: r.id, accept: "0" }} submit="Ablehnen" />
                </span>
              </div>
            ))}
          </section>
          <section aria-labelledby="out-h" className="stack">
            <h2 id="out-h">Gesendete Anfragen</h2>
            {contactData[0].outgoing.length === 0 ? <p className="muted">Keine offenen gesendeten Anfragen.</p> : contactData[0].outgoing.map((r) => (
              <div key={r.id} className="card tight row between">
                <span className="row"><Avatar name={r.to.handle} /><Link href={`/app/profil/${encodeURIComponent(r.to.handle)}`}>{r.to.handle}</Link></span>
                <HiddenForm action={withdrawContactAction} fields={{ requestId: r.id }} submit="Zurückziehen" />
              </div>
            ))}
          </section>
          <section aria-labelledby="con-h" className="stack">
            <h2 id="con-h">Deine Kontakte</h2>
            {contactData[1].length === 0 ? <p className="muted">Noch keine Kontakte.</p> : contactData[1].map((c) => (
              <div key={c.id} className="card tight row between">
                <span className="row"><Avatar name={c.other.handle} /><Link href={`/app/profil/${encodeURIComponent(c.other.handle)}`}>{c.other.handle}</Link><VerifiedBadge verified={c.other.verifiedBadge} /></span>
                <span className="row">
                  <Link className="btn small" href={`/app/nachrichten/neu?an=${encodeURIComponent(c.other.handle)}`}>Schreiben</Link>
                  <HiddenForm action={endConnectionAction} fields={{ targetId: c.other.id }} submit="Verbindung beenden" confirm="Verbindung wirklich beenden?" />
                </span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
