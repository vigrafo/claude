import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { Empty, Gate, formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { toggleGoldBookmarkAction } from "@/app/actions/member/account";

export const metadata: Metadata = { title: "Gold-Bibliothek" };

const KIND: Record<string, string> = { article: "Artikel", interview: "Interview", workshop: "Workshop", video: "Video", event_insight: "Event-Einblick" };

export default async function Gold({ searchParams }: { searchParams: Promise<{ q?: string; kategorie?: string; merkliste?: string }> }) {
  const sp = await searchParams;
  const { profileId, v } = await actingProfile();
  const c = v.can("gold_content");
  // Serverseitige Sperre: ohne Gold werden keine Inhalte geladen
  if (!c.allowed) {
    return (<div className="stack"><h1>Gold-Bibliothek</h1><Gate reason={`${c.reason} Redaktionelle Artikel, Interviews und Workshops sind in Gold enthalten.`} cta={{ href: v.verified ? "/app/konto/tarif" : "/app/verifizierung", label: v.verified ? "Gold ansehen" : "Jetzt verifizieren" }} /></div>);
  }
  const q = (sp.q ?? "").trim().slice(0, 100);
  const now = new Date();
  const base = { status: "published", publishAt: { lte: now } };
  const bookmarks = new Set((await db.goldBookmark.findMany({ where: { profileId }, select: { contentId: true } })).map((b) => b.contentId));
  const [items, cats] = await Promise.all([
    db.goldContent.findMany({
      where: {
        ...base,
        ...(sp.kategorie ? { category: sp.kategorie } : {}),
        ...(sp.merkliste ? { id: { in: [...bookmarks] } } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { summary: { contains: q, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: { publishAt: "desc" }, take: 60,
      select: { id: true, slug: true, title: true, kind: true, category: true, summary: true, publishAt: true },
    }),
    db.goldContent.findMany({ where: base, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Gold-Bibliothek</h1>
      <form method="get" role="search" className="row">
        <label htmlFor="gq" className="sr-only">Bibliothek durchsuchen</label>
        <input id="gq" name="q" type="search" defaultValue={q} placeholder="Suchen" style={{ flex: 1, minWidth: 180 }} />
        <label htmlFor="gk" className="sr-only">Kategorie</label>
        <select id="gk" name="kategorie" defaultValue={sp.kategorie ?? ""} style={{ width: "auto" }}>
          <option value="">Alle Kategorien</option>
          {cats.map((x) => <option key={x.category} value={x.category}>{x.category}</option>)}
        </select>
        <label className="check" style={{ margin: 0 }}><input type="checkbox" name="merkliste" value="1" defaultChecked={!!sp.merkliste} /> Nur Merkliste</label>
        <button className="btn secondary" type="submit">Filtern</button>
      </form>
      {items.length === 0 ? <Empty title="Keine Inhalte gefunden">{q || sp.kategorie || sp.merkliste ? "Passe Suche oder Filter an." : "Die Redaktion veröffentlicht hier bald die ersten Inhalte."}</Empty> : (
        <div className="grid grid-3">
          {items.map((it) => (
            <article key={it.id} className="card stack">
              <div className="row"><span className="badge neutral">{KIND[it.kind] ?? it.kind}</span><span className="dim">{it.category}</span></div>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}><Link href={`/app/gold/${it.slug}`}>{it.title}</Link></h2>
              <p className="muted" style={{ margin: 0 }}>{it.summary}</p>
              <div className="row between">
                <span className="dim">{formatDate(it.publishAt)}</span>
                <HiddenForm action={toggleGoldBookmarkAction} fields={{ contentId: it.id }} submit={bookmarks.has(it.id) ? "★ Gemerkt" : "☆ Merken"} submitClass="btn ghost small" />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
