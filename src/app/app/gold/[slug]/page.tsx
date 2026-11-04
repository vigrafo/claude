import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { Gate, formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { toggleGoldBookmarkAction } from "@/app/actions/member/account";

export const metadata: Metadata = { title: "Gold-Bibliothek" };

export default async function GoldDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profileId, v } = await actingProfile();
  const c = v.can("gold_content");
  // Rechteprüfung VOR dem Laden des Inhalts
  if (!c.allowed) return <Gate reason={c.reason ?? "Gold-Funktion."} cta={{ href: v.verified ? "/app/konto/tarif" : "/app/verifizierung", label: v.verified ? "Gold ansehen" : "Jetzt verifizieren" }} />;
  const it = await db.goldContent.findFirst({ where: { slug, status: "published", publishAt: { lte: new Date() } } });
  if (!it) notFound();
  const bm = await db.goldBookmark.findUnique({ where: { profileId_contentId: { profileId, contentId: it.id } } });
  return (
    <article className="stack" style={{ maxWidth: 760 }}>
      <Link href="/app/gold" className="dim">← Gold-Bibliothek</Link>
      <h1 style={{ margin: 0 }}>{it.title}</h1>
      <div className="row between">
        <span className="dim">{it.category} · {formatDate(it.publishAt)}</span>
        <HiddenForm action={toggleGoldBookmarkAction} fields={{ contentId: it.id }} submit={bm ? "★ Gemerkt" : "☆ Merken"} submitClass="btn ghost small" />
      </div>
      <p className="muted" style={{ fontSize: "1.1rem" }}>{it.summary}</p>
      {/* Text wird escaped gerendert – kein HTML aus dem CMS */}
      <div className="card" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{it.body}</div>
    </article>
  );
}
