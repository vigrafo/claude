import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile, enabledPaymentProvider } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { RESERVATION_MINUTES } from "@/server/events";
import { Gate, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm, ReportForm } from "@/app/app/_components/forms";
import { cancelTicketAction, payTicketAction, reserveTicketAction } from "@/app/actions/member/events";
import { EUROPE } from "@/domain/countries";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Event" };

const STATUS: Record<string, string> = {
  reserved: "Reserviert – bitte bezahlen", awaiting_provider: "Reserviert – Vorauszahlung beim Anbieter", waitlist: "Warteliste",
  paid: "Bezahlt", canceled: "Storniert", expired: "Abgelaufen", refunded: "Erstattet",
};

export default async function EventDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bestellung?: string }> }) {
  const { id } = await params;
  const { bestellung } = await searchParams;
  const { userId, profileId, v } = await actingProfile();
  const c = v.can("community");
  if (!c.allowed) return <Gate reason={c.reason ?? "Nur für verifizierte Profile."} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />;
  const e = await db.event.findUnique({ where: { id }, include: { ticketTypes: true, club: true, organizer: { select: { legalName: true, isPartner: true } } } });
  if (!e || e.status !== "approved" || e.endsAt < new Date()) notFound();
  const now = new Date();
  const [used, mine, provider] = await Promise.all([
    db.ticketOrder.groupBy({
      by: ["ticketTypeId"], _sum: { quantity: true },
      where: { eventId: e.id, OR: [{ status: "paid" }, { status: { in: ["reserved", "awaiting_provider"] }, reservedUntil: { gt: now } }] },
    }),
    db.ticketOrder.findMany({ where: { eventId: e.id, userId, profileId }, orderBy: { createdAt: "desc" } }),
    enabledPaymentProvider(),
  ]);
  const usedBy = new Map(used.map((u) => [u.ticketTypeId, u._sum.quantity ?? 0]));
  const gold = v.can("gold_discount");
  const ttName = new Map(e.ticketTypes.map((t) => [t.id, t.name]));
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div>
        <Link href="/app/events" className="dim">← Events</Link>
        <h1 style={{ margin: "4px 0 0" }}>{e.title}</h1>
        <div className="muted">{formatDate(e.startsAt, true)} – {formatDate(e.endsAt, true)}</div>
        <div className="muted">{[e.club?.name, e.city, EUROPE.find((x) => x.code === e.regionCountry)?.nameDe].filter(Boolean).join(" · ")} · Veranstalter: {e.organizer.legalName}</div>
      </div>

      {mine.length > 0 && (
        <section className="card stack" aria-labelledby="mine-h">
          <h2 id="mine-h">Deine Buchungen</h2>
          {mine.map((o) => {
            const active = (o.status === "reserved" || o.status === "awaiting_provider") && o.reservedUntil && o.reservedUntil > now;
            return (
              <div key={o.id} className="card tight stack" style={o.id === bestellung ? { borderColor: "var(--red)" } : undefined}>
                <div className="row between">
                  <strong>{o.quantity}× {ttName.get(o.ticketTypeId) ?? "Ticket"}</strong>
                  <span className="badge neutral">{active || !["reserved", "awaiting_provider"].includes(o.status) ? STATUS[o.status] ?? o.status : "Abgelaufen"}</span>
                </div>
                <div className="muted">
                  Gesamt {formatCents(o.grossCents)}{o.discountCents > 0 ? ` · Gold-Rabatt −${formatCents(o.discountCents)}` : ""} · <strong>zu zahlen {formatCents(o.payableCents)}</strong>
                </div>
                {active && o.reservedUntil && <div className="dim">Reserviert bis {formatDate(o.reservedUntil, true)} ({RESERVATION_MINUTES} Minuten).</div>}
                {o.status === "waitlist" && <div className="dim">Du stehst auf der Warteliste. Wird ein Platz frei, melden wir uns.</div>}
                <div className="row">
                  {active && o.status === "reserved" && !e.providerPaymentUrl && (provider
                    ? <HiddenForm action={payTicketAction} fields={{ ticketOrderId: o.id }} submit={`Bezahlen (${formatCents(o.payableCents)})`} submitClass="btn small" />
                    : <span className="alert warn" style={{ margin: 0 }}>Derzeit ist keine Zahlungsart verfügbar.</span>)}
                  {active && e.providerPaymentUrl && (
                    <a className="btn small" href={e.providerPaymentUrl} target="_blank" rel="noopener noreferrer">Vorauszahlung direkt beim Anbieter</a>
                  )}
                  {(active || o.status === "waitlist") && (
                    <HiddenForm action={cancelTicketAction} fields={{ ticketOrderId: o.id }} submit="Stornieren" confirm="Reservierung wirklich stornieren?" />
                  )}
                </div>
                {active && e.providerPaymentUrl && (
                  <p className="hint" style={{ margin: 0 }}>Du zahlst direkt an den Anbieter. eropub bestätigt den Zahlungseingang manuell – das kann etwas dauern.</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="desc-h">
          <h2 id="desc-h">Beschreibung</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{e.description}</p>
          {e.requirements && (<><h3>Voraussetzungen</h3><p style={{ whiteSpace: "pre-wrap" }}>{e.requirements}</p></>)}
          {e.cancellationPolicy && (<><h3>Stornobedingungen</h3><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.cancellationPolicy}</p></>)}
          {e.club && <p style={{ marginTop: 12 }}><Link href={`/app/clubs/${e.club.id}`}>Mehr zum Club {e.club.name}</Link></p>}
        </section>
        <section className="card stack" aria-labelledby="tix-h">
          <h2 id="tix-h">Tickets</h2>
          {e.ticketTypes.length === 0 ? <p className="muted">Keine Tickets verfügbar.</p> : e.ticketTypes.map((t) => {
            const left = Math.max(0, t.quota - (usedBy.get(t.id) ?? 0));
            return (
              <div key={t.id} className="card tight stack">
                <div className="row between">
                  <strong>{t.name}</strong>
                  <span>{formatCents(t.priceCents)}{t.feeCents ? ` + ${formatCents(t.feeCents)} Gebühr` : ""}</span>
                </div>
                <div className="dim">{left === 0 ? "Ausgebucht – Reservierung kommt auf die Warteliste" : left <= 5 ? `Nur noch wenige Plätze (${left})` : "Plätze verfügbar"}{t.personsPerTicket > 1 ? ` · gilt für ${t.personsPerTicket} Personen` : ""}</div>
                <ActionForm action={reserveTicketAction} submit={left === 0 ? "Auf die Warteliste" : "Reservieren"} submitClass="btn small">
                  <input type="hidden" name="ticketTypeId" value={t.id} />
                  <div className="field" style={{ maxWidth: 140 }}>
                    <label htmlFor={`q-${t.id}`}>Anzahl</label>
                    <select id={`q-${t.id}`} name="quantity" defaultValue="1">{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
                  </div>
                </ActionForm>
              </div>
            );
          })}
          <p className="hint" style={{ margin: 0 }}>Eine Reservierung hält deinen Platz {RESERVATION_MINUTES} Minuten. Den genauen Betrag siehst du vor dem Bezahlen.</p>
        </section>
      </div>

      <section className="card" aria-labelledby="gold-h">
        <h2 id="gold-h">Gold-Rabatt</h2>
        <ul className="checks">
          <li>10 € Rabatt auf ein berechtigtes Ticket pro Event – nur für aktive, verifizierte Gold-Mitglieder.</li>
          <li>Gebühren sind nicht rabattfähig; der Rabatt ist nicht mit anderen Gutscheinen kombinierbar.</li>
          <li>Nur bei Events, die eropub dafür freigegeben hat.</li>
        </ul>
        <p className="muted" style={{ margin: 0 }}>
          {!e.goldDiscountEligible ? "Dieses Event ist nicht für den Gold-Rabatt freigegeben." : gold.allowed ? "Du bist berechtigt – der Rabatt wird bei der Reservierung automatisch berechnet." : `${gold.reason ?? ""} `}
          {e.goldDiscountEligible && !gold.allowed && <Link href="/app/konto/tarif">Gold ansehen</Link>}
        </p>
      </section>
      <ReportForm targetType="event" targetId={e.id} label="Event melden" />
    </div>
  );
}
