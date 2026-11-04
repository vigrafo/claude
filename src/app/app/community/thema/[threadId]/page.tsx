import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { canWriteInGroup } from "@/server/community";
import { db } from "@/server/db";
import { blockedIds } from "@/server/discover";
import { Gate, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { ReportForm } from "@/app/app/_components/forms";
import { editPostAction, replyAction } from "@/app/actions/member/community";

export const metadata: Metadata = { title: "Thema" };

export default async function Thema({ params, searchParams }: { params: Promise<{ threadId: string }>; searchParams: Promise<{ zitat?: string }> }) {
  const { threadId } = await params;
  const { zitat } = await searchParams;
  const { userId, profileId, v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return <Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />;
  const t = await db.thread.findUnique({ where: { id: threadId }, include: { category: { include: { group: true } } } });
  if (!t) notFound();
  const g = t.category.group;
  let canWrite = true;
  if (g) {
    if (g.status !== "approved") notFound();
    const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId: g.id, profileId } } });
    // Private Gruppeninhalte nie für Nicht-Mitglieder
    if (g.visibility !== "open" && m?.status !== "active") notFound();
    canWrite = await canWriteInGroup(userId, profileId, g.id);
  }
  const hidden = await blockedIds(profileId);
  const posts = await db.post.findMany({
    where: { threadId, hidden: false }, orderBy: { createdAt: "asc" }, take: 500,
    include: { author: { select: { handle: true, status: true } } },
  });
  const byId = new Map(posts.map((p) => [p.id, p]));
  const quote = zitat ? byId.get(zitat) : undefined;
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div>
        {g ? <Link href={`/app/community/${g.slug}`} className="dim">← {g.name}</Link> : <Link href="/app/community" className="dim">← Community</Link>}
        <h1 style={{ margin: "4px 0 0" }}>{t.title}</h1>
        <div className="row" style={{ marginTop: 6 }}>
          {t.official && <span className="badge plan">eropub</span>}
          {t.locked && <span className="badge neutral">🔒 Geschlossen – nur lesen</span>}
        </div>
      </div>
      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {posts.map((p) => {
          const blockedAuthor = p.authorId && hidden.has(p.authorId);
          const mine = p.authorId === profileId && p.authorUserId === userId;
          const q = p.quoteId ? byId.get(p.quoteId) : undefined;
          return (
            <li key={p.id} id={`p-${p.id}`} className="card stack">
              <div className="row between">
                <strong>{p.official ? "eropub" : p.author?.status === "active" ? p.author.handle : "gelöschtes Profil"}</strong>
                <span className="dim" style={{ fontSize: "0.85rem" }}>{formatDate(p.createdAt, true)}{p.editedAt ? " · bearbeitet" : ""}</span>
              </div>
              {blockedAuthor ? <p className="muted" style={{ margin: 0 }}>Beitrag eines blockierten Profils ausgeblendet.</p> : (
                <>
                  {q && (
                    <blockquote style={{ margin: 0, padding: "8px 12px", borderLeft: "3px solid var(--line)", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                      {q.body.slice(0, 400)}{q.body.length > 400 ? " …" : ""}
                    </blockquote>
                  )}
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.body}</p>
                </>
              )}
              <div className="row">
                {!t.locked && canWrite && !blockedAuthor && <Link className="btn ghost small" href={`/app/community/thema/${t.id}?zitat=${p.id}#antwort`}>Zitieren</Link>}
                {mine && !t.locked && (
                  <details>
                    <summary className="btn ghost small">Bearbeiten</summary>
                    <div style={{ marginTop: 8 }}>
                      <ActionForm action={editPostAction} submit="Änderung speichern" submitClass="btn small">
                        <input type="hidden" name="postId" value={p.id} />
                        <label htmlFor={`e-${p.id}`} className="sr-only">Beitrag bearbeiten</label>
                        <textarea id={`e-${p.id}`} name="body" defaultValue={p.body} rows={5} />
                      </ActionForm>
                    </div>
                  </details>
                )}
                {!mine && !p.official && <ReportForm targetType="post" targetId={p.id} />}
              </div>
            </li>
          );
        })}
      </ol>
      {t.locked ? (
        <p className="alert info">Dieses Thema ist geschlossen. Du kannst es weiterhin lesen.</p>
      ) : !canWrite ? (
        <p className="alert info">{g ? "Tritt der Gruppe bei (oder warte auf dein Schreibrecht), um zu antworten." : "Antworten ist derzeit nicht möglich."}</p>
      ) : (
        <section id="antwort" className="card" aria-labelledby="reply-h">
          <h2 id="reply-h">Antworten</h2>
          {quote && (
            <div className="alert info">Du zitierst {quote.author?.handle ?? "eropub"}: „{quote.body.slice(0, 160)}{quote.body.length > 160 ? " …" : ""}“ <Link href={`/app/community/thema/${t.id}#antwort`}>Zitat entfernen</Link></div>
          )}
          <ActionForm action={replyAction} submit="Antwort veröffentlichen" resetOnSuccess>
            <input type="hidden" name="threadId" value={t.id} />
            {quote && <input type="hidden" name="quoteId" value={quote.id} />}
            <div className="field">
              <label htmlFor="reply-body">Deine Antwort</label>
              <textarea id="reply-body" name="body" required rows={5} aria-describedby="reply-hint" />
              <p className="hint" id="reply-hint">Respektvoll und nicht explizit. Höchstens 10.000 Zeichen.</p>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
