import Link from "next/link";
import { adminGuard } from "../_lib/guard";
import { Kpi, PageHead, money, sp, type SP } from "../_lib/ui";
import { ADMIN_NAV } from "../_lib/nav";
import { dashboardKpis, dbPing } from "@/server/admin/ops";
import { verifyAuditChain } from "@/server/audit";
import { PLAN_LABEL } from "@/domain/plans";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard();
  const params = await searchParams;
  const forbidden = sp(params, "forbidden") === "1";
  if (!a.has("dashboard.view")) {
    const first = ADMIN_NAV.flatMap((g) => g.items).filter((i) => a.has(i.perm));
    return (
      <>
        <PageHead title="Administration" />
        {forbidden && <p className="alert error" role="alert">Für diesen Bereich fehlt dir die Berechtigung.</p>}
        <ul>{first.map((i) => <li key={i.href}><Link href={i.href}>{i.label}</Link></li>)}</ul>
      </>
    );
  }
  const [k, ping, chain] = await Promise.all([dashboardKpis(), dbPing(), verifyAuditChain()]);
  return (
    <>
      <PageHead title="Dashboard">Echte Kennzahlen aus der Datenbank. Stand: jetzt.</PageHead>
      {forbidden && <p className="alert error" role="alert">Für diesen Bereich fehlt dir die Berechtigung.</p>}
      <section className="admin-section">
        <h2>Gesundheit</h2>
        <div className="grid grid-3">
          <Kpi label="Datenbank" value={ping.ok ? `OK · ${ping.ms} ms` : "Fehler"} />
          <Kpi label="Audit-Hashkette" value={chain.ok ? "intakt" : "GEBROCHEN"} href={a.has("ops.view") ? "/admin/betrieb" : undefined} />
          <Kpi label="Webhook-Fehler (24 h)" value={k.webhookFailures} href={a.has("providers.manage") ? "/admin/zahlungsanbieter?status=rejected" : undefined} />
        </div>
        {!chain.ok && <p className="alert error" role="alert">Audit-Kette gebrochen bei Eintrag {chain.brokenAt}. Bitte sofort prüfen.</p>}
      </section>
      <section className="admin-section">
        <h2>Mitglieder & Warteschlangen</h2>
        <div className="grid grid-4">
          <Kpi label="Personen gesamt" value={k.members} href={a.has("users.read") ? "/admin/personen" : undefined} />
          <Kpi label="Verifizierte Profile" value={k.verifiedProfiles} />
          <Kpi label="Offene Verifizierungen" value={k.pendingVerifications} href={a.has("verification.review") ? "/admin/verifizierung" : undefined} />
          <Kpi label="Gruppenanträge" value={k.pendingGroups} href={a.has("groups.manage") ? "/admin/gruppen" : undefined} />
          <Kpi label="Events zur Freigabe" value={k.pendingEvents} href={a.has("events.manage") ? "/admin/events" : undefined} />
          <Kpi label="Veranstalter zur Prüfung" value={k.pendingOrganizers} href={a.has("events.manage") ? "/admin/events" : undefined} />
          <Kpi label="Clubs zur Prüfung" value={k.pendingClubs} href={a.has("events.manage") ? "/admin/events" : undefined} />
          <Kpi label="Offene Moderationsfälle" value={k.openCases} href={a.has("moderation.handle") ? "/admin/moderation" : undefined} />
          <Kpi label="Offene Supporttickets" value={k.openTickets} href={a.has("support.handle") ? "/admin/support" : undefined} />
          <Kpi label="Outbox wartend" value={k.outboxPending} href={a.has("ops.view") ? "/admin/betrieb" : undefined} />
          <Kpi label="Outbox fehlgeschlagen" value={k.outboxFailed} href={a.has("ops.view") ? "/admin/betrieb?outbox=failed" : undefined} />
        </div>
      </section>
      <section className="admin-section">
        <h2>Abos & Umsatz</h2>
        <div className="grid grid-4">
          {k.subsByPlan.length === 0 && <Kpi label="Aktive Abos" value={0} />}
          {k.subsByPlan.map((s) => <Kpi key={s.plan} label={`Aktive Abos ${PLAN_LABEL[s.plan]}`} value={s.count} />)}
          {k.revenue30d.length === 0 && <Kpi label="Umsatz 30 Tage (bezahlt)" value={money(0)} />}
          {k.revenue30d.map((r) => <Kpi key={r.currency} label={`Umsatz 30 Tage (${r.currency})`} value={money(r.cents, r.currency)} href={a.has("finance.read") ? "/admin/finanzen" : undefined} />)}
        </div>
        <p className="hint">Umsatz = Bruttobeträge bezahlter Bestellungen (inkl. USt.), Erstattungen nicht abgezogen.</p>
      </section>
    </>
  );
}
