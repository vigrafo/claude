import Link from "next/link";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, Reason, Select, StatusBadge, money, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import {
  clubDecideAction, clubRateAction, eventDecideAction, organizerDecideAction, organizerPartnerAction, providerPaymentAction,
} from "@/app/actions/admin/events";

const DECIDE = [{ value: "approved", label: "freigeben" }, { value: "rejected", label: "ablehnen" }, { value: "suspended", label: "sperren" }];

export default async function EventsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("events.manage");
  const params = await searchParams;
  const tab = sp(params, "tab") || "events";
  const status = sp(params, "status");
  const eventId = sp(params, "event");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const tabs = [["events", "Events"], ["organizers", "Veranstalter"], ["clubs", "Clubs"]];
  const nav = <nav className="row" aria-label="Ansicht">{tabs.map(([k, l]) => <Link key={k} className={`btn small ${tab === k && !eventId ? "" : "secondary"}`} href={`/admin/events?tab=${k}`}>{l}</Link>)}</nav>;

  if (eventId) return <EventDetail id={eventId} nav={nav} />;

  if (tab === "organizers") {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([db.organizer.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { profile: { select: { handle: true } } } }), db.organizer.count({ where })]);
    return (
      <>
        <PageHead title="Veranstaltungen – Veranstalter" />{nav}
        <StatusFilter tab="organizers" status={status} options={["pending", "approved", "rejected", "suspended"]} />
        {rows.length === 0 ? <Empty title="Keine Veranstalter" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Veranstalter</th><th>Profil</th><th>Status</th><th>Partner</th><th>Prüfen</th><th>Partnerstatus</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                <td>{o.legalName}<div className="dim">{o.contactEmail}</div></td><td>{o.profile.handle}</td><td><StatusBadge status={o.status} /></td>
                <td>{o.isPartner ? `ja · ${o.partnerContractRef}` : "nein"}</td>
                <td><ActionForm action={organizerDecideAction} submit="Speichern" submitClass="btn small"><input type="hidden" name="id" value={o.id} /><Select label="Entscheidung" name="status" options={DECIDE} /><Reason min={3} /></ActionForm></td>
                <td><ActionForm action={organizerPartnerAction} submit="Speichern" submitClass="btn small secondary">
                  <input type="hidden" name="id" value={o.id} />
                  <Field label="Vertraglicher Partner" name="isPartner" type="checkbox" defaultValue={o.isPartner ? "1" : ""} />
                  <Field label="Vertragsreferenz" name="contractRef" defaultValue={o.partnerContractRef ?? ""} />
                </ActionForm></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/events" params={params} page={page} total={total} />
      </>
    );
  }

  if (tab === "clubs") {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([db.club.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { organizer: { select: { legalName: true } } } }), db.club.count({ where })]);
    return (
      <>
        <PageHead title="Veranstaltungen – Clubs">Sterne (1–5) vergibt ausschließlich eropub.</PageHead>{nav}
        <StatusFilter tab="clubs" status={status} options={["pending", "approved", "rejected", "suspended"]} />
        {rows.length === 0 ? <Empty title="Keine Clubs" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Club</th><th>Ort</th><th>Kapazität</th><th>Status</th><th>Sterne</th><th>Prüfen</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}<div className="dim">{c.organizer.legalName}</div></td><td>{c.postalCode} {c.city}, {c.country}</td><td>{c.capacity}{c.areaSqm ? ` · ${c.areaSqm} m²` : ""}</td>
                <td><StatusBadge status={c.status} /></td>
                <td><ActionForm action={clubRateAction} submit="Bewerten" submitClass="btn small secondary" className="admin-inline"><input type="hidden" name="id" value={c.id} /><Select label="Sterne" name="stars" defaultValue={String(c.stars ?? 3)} options={["1", "2", "3", "4", "5"]} /></ActionForm></td>
                <td><ActionForm action={clubDecideAction} submit="Speichern" submitClass="btn small"><input type="hidden" name="id" value={c.id} /><Select label="Entscheidung" name="status" options={DECIDE} /><Reason min={3} /></ActionForm></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/events" params={params} page={page} total={total} />
      </>
    );
  }

  const where = status ? { status } : { status: "pending_approval" };
  const [rows, total] = await Promise.all([
    db.event.findMany({ where, skip, take, orderBy: { startsAt: "asc" }, include: { organizer: { select: { legalName: true, isPartner: true } }, club: { select: { name: true, capacity: true } }, ticketTypes: true } }),
    db.event.count({ where }),
  ]);
  return (
    <>
      <PageHead title="Veranstaltungen">Events freigeben, Gold-Rabatt (nur eropub-Events oder vertragliche Partner), Kapazität und Tickets.</PageHead>{nav}
      <StatusFilter tab="events" status={status || "pending_approval"} options={["pending_approval", "approved", "rejected", "canceled", "draft"]} />
      {rows.length === 0 ? <Empty title="Keine Events in dieser Ansicht" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Event</th><th>Termin</th><th>Veranstalter</th><th>Kapazität</th><th>Status</th><th>Entscheidung</th></tr></thead>
          <tbody>{rows.map((e) => {
            const sold = e.ticketTypes.reduce((s, t) => s + t.sold, 0);
            return (
              <tr key={e.id}>
                <td><Link href={`/admin/events?event=${e.id}`}>{e.title}</Link><div className="dim">{e.city ?? ""} {e.regionCountry}{e.isEropubEvent ? " · eropub" : ""}</div></td>
                <td>{formatDate(e.startsAt, true)}</td>
                <td>{e.organizer.legalName}{e.organizer.isPartner && <span className="badge plan">Partner</span>}</td>
                <td>{sold}/{e.capacity}{e.club ? ` (Club ${e.club.capacity})` : ""}</td>
                <td><StatusBadge status={e.status} />{e.goldDiscountEligible && <span className="badge plan">Gold-Rabatt</span>}</td>
                <td><ActionForm action={eventDecideAction} submit="Speichern" submitClass="btn small">
                  <input type="hidden" name="id" value={e.id} />
                  <Select label="Status" name="status" options={[{ value: "approved", label: "freigeben" }, { value: "rejected", label: "ablehnen" }, { value: "canceled", label: "absagen" }]} />
                  <Field label="Gold-Rabatt-fähig" name="goldEligible" type="checkbox" defaultValue={e.goldDiscountEligible ? "1" : ""} />
                </ActionForm></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <Pager base="/admin/events" params={params} page={page} total={total} />
    </>
  );
}

function StatusFilter({ tab, status, options }: { tab: string; status: string; options: string[] }) {
  return (
    <form method="get" className="admin-search row" style={{ marginTop: 16 }}>
      <input type="hidden" name="tab" value={tab} />
      <div className="field"><label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status}><option value="">alle</option>{options.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <button className="btn small" type="submit">Filtern</button>
    </form>
  );
}

async function EventDetail({ id, nav }: { id: string; nav: React.ReactNode }) {
  const e = await db.event.findUnique({ where: { id }, include: { ticketTypes: true, club: true, organizer: true } });
  if (!e) return <Empty title="Event nicht gefunden" />;
  const orders = await db.ticketOrder.findMany({ where: { eventId: id }, orderBy: { createdAt: "asc" }, include: { profile: { select: { handle: true } } } });
  const active = orders.filter((o) => ["reserved", "paid", "awaiting_provider"].includes(o.status)).reduce((s, o) => s + o.quantity, 0);
  const waitlist = orders.filter((o) => o.status === "waitlist");
  return (
    <>
      <PageHead title={e.title}><Link href="/admin/events">← Zur Liste</Link></PageHead>{nav}
      <section className="card admin-section">
        <dl className="admin-kv">
          <dt>Status</dt><dd><StatusBadge status={e.status} /></dd>
          <dt>Termin</dt><dd>{formatDate(e.startsAt, true)} – {formatDate(e.endsAt, true)}</dd>
          <dt>Veranstalter</dt><dd>{e.organizer.legalName}{e.organizer.isPartner ? ` · Partner (${e.organizer.partnerContractRef})` : ""}</dd>
          <dt>Kapazität</dt><dd>{active} belegt / {e.capacity} {e.club ? `· Club ${e.club.name}: ${e.club.capacity}` : ""}</dd>
          <dt>Warteliste</dt><dd>{waitlist.length} Bestellungen</dd>
          <dt>Direktzahlung an Anbieter</dt><dd>{e.providerPaymentUrl ?? "nein"}</dd>
          <dt>Tickets</dt><dd>{e.ticketTypes.map((t) => `${t.name}: ${money(t.priceCents)} · Kontingent ${t.quota} · verkauft ${t.sold}`).join(" | ") || "–"}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Ticketbestellungen</h2>
        {orders.length === 0 ? <p className="muted">Keine Bestellungen.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Bestellt</th><th>Profil</th><th>Anzahl</th><th>Brutto</th><th>Rabatt</th><th>Zu zahlen</th><th>Status</th><th>Abgleich</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}>
                <td>{formatDate(o.createdAt, true)}</td><td>{o.profile.handle}</td><td>{o.quantity}</td><td>{money(o.grossCents)}</td><td>{money(o.discountCents)}</td><td>{money(o.payableCents)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>{["awaiting_provider", "reserved"].includes(o.status) && e.providerPaymentUrl ? (
                  <ActionForm action={providerPaymentAction} submit="Zahlung bestätigen" submitClass="btn small">
                    <input type="hidden" name="ticketOrderId" value={o.id} />
                    <Field label="Abgleichsnachweis" name="note" required />
                  </ActionForm>
                ) : "–"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
