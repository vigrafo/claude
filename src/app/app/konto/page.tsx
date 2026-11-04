import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { priceOutlook } from "@/server/subscriptions";
import { formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { cancelSubscriptionAction } from "@/app/actions/member/account";
import { DEFAULT_PRICES, PLAN_LABEL, effectivePlanLabel } from "./labels";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Konto" };

const SUB_STATUS: Record<string, string> = {
  pending: "Wird eingerichtet", active: "Aktiv", past_due: "Zahlung offen", cancel_at_period_end: "Gekündigt zum Periodenende", canceled: "Beendet", expired: "Abgelaufen",
};
const ORDER_STATUS: Record<string, string> = {
  created: "Angelegt", pending: "Zahlung offen", paid: "Bezahlt", failed: "Fehlgeschlagen", canceled: "Abgebrochen", refunded: "Erstattet", partially_refunded: "Teilweise erstattet", chargeback: "Rückbuchung",
};
const LEDGER_KIND: Record<string, string> = {
  purchase: "Kauf", message: "Nachricht", gift: "Geschenk", refund_technical: "Erstattung (technisch)", admin_credit: "Gutschrift", admin_debit: "Korrektur", chargeback: "Rückbuchung", refund_payment: "Erstattung",
};

function ddmmyyyy(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
}

export default async function Konto() {
  const { userId, profileId, v } = await actingProfile();
  const [subs, outlook, ledger, orders] = await Promise.all([
    db.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    priceOutlook(userId),
    db.tokenLedgerEntry.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, include: { invoice: true } }),
  ]);
  const premiumActive = subs.some((s) => s.plan === "premium" && ["active", "cancel_at_period_end"].includes(s.status));
  const invoices = orders.filter((o) => o.invoice);
  const open = orders.filter((o) => o.status === "pending" || o.status === "created");
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Konto</h1>
      <div className="grid grid-3">
        <section className="card stack" aria-labelledby="plan-h">
          <h2 id="plan-h">Dein Tarif</h2>
          <div className="kpi">{PLAN_LABEL[v.person.plan]}</div>
          <p className="muted" style={{ margin: 0 }}>{effectivePlanLabel(v.person.plan, v.verified)}</p>
          <Link className="btn secondary small" href="/app/konto/tarif">Tarife vergleichen</Link>
        </section>
        <section className="card stack" aria-labelledby="tok-h">
          <h2 id="tok-h">Tokens</h2>
          <div className="kpi">{v.profileRow.tokenBalance}</div>
          <p className="muted" style={{ margin: 0 }}>Guthaben des Profils {v.profileRow.handle}{v.profileRow.type === "couple" ? " (gemeinsam)" : ""}.</p>
          <Link className="btn secondary small" href="/app/konto/tokens">Tokens kaufen</Link>
        </section>
        {outlook.firstRegularCharge && (
          <section className="card stack" aria-labelledby="out-h">
            <h2 id="out-h">Preisausblick Premium</h2>
            <p style={{ margin: 0 }}>Ab dem {ddmmyyyy(outlook.firstRegularCharge)}: {formatCents(DEFAULT_PRICES.premiumRegularCents)} pro Monat.</p>
            <p className="dim" style={{ margin: 0 }}>Der Einführungspreis gilt 24 Monate ab deiner ersten Premium- oder Gold-Aktivierung{outlook.introEndsAt ? ` (bis ${ddmmyyyy(outlook.introEndsAt)})` : ""}. {premiumActive ? "" : "Eine Neubuchung setzt die Frist nicht zurück."}</p>
          </section>
        )}
      </div>

      <section className="stack" aria-labelledby="subs-h">
        <h2 id="subs-h">Mitgliedschaften</h2>
        {subs.length === 0 ? <p className="muted">Du nutzt Basis. <Link href="/app/konto/tarif">Premium oder Gold ansehen</Link></p> : subs.map((s) => (
          <div key={s.id} className="card tight row between">
            <span>
              <strong>{PLAN_LABEL[s.plan]}</strong> <span className="badge neutral">{SUB_STATUS[s.status] ?? s.status}</span>
              <span className="dim" style={{ display: "block" }}>
                {s.currentPeriodEnd ? `${s.status === "active" ? "Nächste Abrechnung" : "Läuft bis"} ${formatDate(s.currentPeriodEnd)}` : `Seit ${formatDate(s.createdAt)}`}
                {s.status === "active" && s.nextPriceCents != null ? ` · ${formatCents(s.nextPriceCents)}` : ""}
              </span>
            </span>
            {(s.status === "active" || s.status === "past_due") && (
              <HiddenForm action={cancelSubscriptionAction} fields={{ subscriptionId: s.id }} submit="Kündigen" confirm="Mitgliedschaft zum Ende des bezahlten Zeitraums kündigen?" />
            )}
          </div>
        ))}
      </section>

      {open.length > 0 && (
        <section className="stack" aria-labelledby="open-h">
          <h2 id="open-h">Offene Zahlungen</h2>
          {open.map((o) => (
            <Link key={o.id} href={`/app/konto/zahlung?order=${o.id}`} className="card card-link tight row between">
              <span>{o.kind === "subscription" ? "Mitgliedschaft" : o.kind === "tokens" ? "Tokens" : "Ticket"} · {formatDate(o.createdAt, true)}</span>
              <span>{formatCents(o.amountCents, o.currency)} · {ORDER_STATUS[o.status]}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="stack" aria-labelledby="inv-h">
        <h2 id="inv-h">Rechnungen</h2>
        {invoices.length === 0 ? <p className="muted">Noch keine Rechnungen.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col">Netto</th><th scope="col">USt.</th><th scope="col">Brutto</th><th scope="col">Status</th></tr></thead>
              <tbody>{invoices.map((o) => (
                <tr key={o.id}><td>{o.invoice!.number}</td><td>{formatDate(o.invoice!.issuedAt)}</td><td>{formatCents(o.invoice!.netCents)}</td><td>{formatCents(o.invoice!.taxCents)}</td><td>{formatCents(o.invoice!.grossCents)}</td><td>{ORDER_STATUS[o.status] ?? o.status}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="led-h">
        <h2 id="led-h">Tokenverlauf</h2>
        {ledger.length === 0 ? <p className="muted">Noch keine Buchungen.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Datum</th><th scope="col">Art</th><th scope="col">Änderung</th><th scope="col">Stand</th></tr></thead>
              <tbody>{ledger.map((l) => (
                <tr key={l.id}><td>{formatDate(l.createdAt, true)}</td><td>{LEDGER_KIND[l.kind] ?? l.kind}</td><td>{l.delta > 0 ? `+${l.delta}` : l.delta}</td><td>{l.balanceAfter}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
