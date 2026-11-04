import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { listVisibleEvents } from "@/server/events";
import { getSetting } from "@/server/settings";
import { Empty, Gate, formatDate } from "@/components/ui";
import { EUROPE } from "@/domain/countries";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Events" };

export default async function Events() {
  const { v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) {
    return (<div className="stack"><h1>Events</h1><Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} /></div>);
  }
  const features = await getSetting("features");
  const events = features.eventsEnabled ? await listVisibleEvents() : [];
  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Events</h1>
        <Link className="btn secondary small" href="/app/clubs">Clubs</Link>
      </div>
      {!features.eventsEnabled ? (
        <p className="alert info">Events sind derzeit pausiert.</p>
      ) : events.length === 0 ? (
        <Empty title="Aktuell keine Events">Sobald geprüfte Veranstalter Events einstellen, findest du sie hier.</Empty>
      ) : (
        <div className="grid grid-2">
          {events.map((e) => {
            const from = e.ticketTypes.length ? Math.min(...e.ticketTypes.map((t) => t.priceCents + t.feeCents)) : null;
            return (
              <Link key={e.id} href={`/app/events/${e.id}`} className="card card-link stack">
                <div className="dim">{formatDate(e.startsAt, true)}</div>
                <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{e.title}</h2>
                <div className="muted">{[e.club?.name, e.city, EUROPE.find((x) => x.code === e.regionCountry)?.nameDe].filter(Boolean).join(" · ")}</div>
                <div className="row">
                  {e.isEropubEvent && <span className="badge plan">eropub-Event</span>}
                  {e.organizer.isPartner && <span className="badge neutral">Partner</span>}
                  {e.goldDiscountEligible && <span className="badge neutral">Gold-Rabatt möglich</span>}
                  {e.club?.stars ? <span className="badge neutral" aria-label={`${e.club.stars} von 5 eropub-Sternen`}>{"★".repeat(e.club.stars)}</span> : null}
                  {from != null && <span className="dim">ab {formatCents(from)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
