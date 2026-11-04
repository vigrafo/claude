import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { Gate, formatDate } from "@/components/ui";
import { ReportForm } from "@/app/app/_components/forms";
import { EUROPE } from "@/domain/countries";
import { Stars } from "@/app/app/_components/Stars";

export const metadata: Metadata = { title: "Club" };

export default async function ClubDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return <Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />;
  const cl = await db.club.findUnique({
    where: { id },
    include: { organizer: { select: { status: true, legalName: true } }, events: { where: { status: "approved", endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 20 } },
  });
  if (!cl || cl.status !== "approved" || cl.organizer.status !== "approved") notFound();
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div>
        <Link href="/app/clubs" className="dim">← Clubs</Link>
        <h1 style={{ margin: "4px 0 0" }}>{cl.name}</h1>
        <div className="row"><Stars n={cl.stars} />{cl.stars ? <span className="dim">nur von eropub vergeben</span> : null}</div>
      </div>
      <div className="grid grid-2">
        <section className="card" aria-labelledby="d-h">
          <h2 id="d-h">Über den Club</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{cl.description}</p>
          {cl.amenities.length > 0 && <div className="chips">{cl.amenities.map((a) => <span key={a} className="chip">{a}</span>)}</div>}
        </section>
        <section className="card" aria-labelledby="f-h">
          <h2 id="f-h">Fakten</h2>
          <dl style={{ margin: 0 }}>
            <dt className="dim">Adresse</dt><dd style={{ margin: "0 0 8px" }}>{cl.street}, {cl.postalCode} {cl.city}, {EUROPE.find((x) => x.code === cl.country)?.nameDe ?? cl.country}</dd>
            {cl.areaSqm ? (<><dt className="dim">Fläche</dt><dd style={{ margin: "0 0 8px" }}>{cl.areaSqm} m²</dd></>) : null}
            <dt className="dim">Kapazität</dt><dd style={{ margin: "0 0 8px" }}>bis {cl.capacity} Personen</dd>
            <dt className="dim">Betreiber</dt><dd style={{ margin: 0 }}>{cl.organizer.legalName}</dd>
          </dl>
        </section>
      </div>
      <section className="stack" aria-labelledby="e-h">
        <h2 id="e-h">Kommende Events</h2>
        {cl.events.length === 0 ? <p className="muted">Derzeit keine Events.</p> : cl.events.map((e) => (
          <Link key={e.id} href={`/app/events/${e.id}`} className="card card-link tight"><strong>{e.title}</strong> <span className="dim">· {formatDate(e.startsAt, true)}</span></Link>
        ))}
      </section>
      <ReportForm targetType="club" targetId={cl.id} label="Club melden" />
    </div>
  );
}
