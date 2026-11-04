import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { Empty, Gate } from "@/components/ui";
import { EUROPE } from "@/domain/countries";
import { Stars } from "@/app/app/_components/Stars";

export const metadata: Metadata = { title: "Clubs" };

export default async function Clubs() {
  const { v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return (<div className="stack"><h1>Clubs</h1><Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} /></div>);
  const clubs = await db.club.findMany({ where: { status: "approved", organizer: { status: "approved" } }, orderBy: [{ country: "asc" }, { city: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Clubs</h1>
      <p className="muted" style={{ margin: 0 }}>Von eropub geprüfte Clubs. Sterne (★) vergibt ausschließlich eropub – nicht die Clubs selbst.</p>
      {clubs.length === 0 ? <Empty title="Noch keine Clubs">Sobald Clubs geprüft sind, findest du sie hier.</Empty> : (
        <div className="grid grid-3">
          {clubs.map((cl) => (
            <Link key={cl.id} href={`/app/clubs/${cl.id}`} className="card card-link stack">
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{cl.name}</h2>
              <div className="muted">{cl.city}, {EUROPE.find((x) => x.code === cl.country)?.nameDe ?? cl.country}</div>
              <Stars n={cl.stars} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
