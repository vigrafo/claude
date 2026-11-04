import Link from "next/link";
import type { Metadata } from "next";
import { actingUser, enabledPaymentProvider } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { Gate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { startPlanCheckoutAction } from "@/app/actions/member/account";
import { DEFAULT_PRICES, PLAN_LABEL, priceForPeriod, type PlanKey } from "@/domain/plans";
import { personIdentityVerified } from "@/domain/access";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Tarif wählen" };

const FEATURES: Record<PlanKey, string[]> = {
  basis: ["Profile entdecken", "Kontaktanfragen", "Nachrichten lesen", "Schreiben mit Tokens (1 Token je Nachricht)", "Kennenlernspiele (verifiziert)", "Gruppen & Foren (verifiziert)"],
  premium: ["Alles aus Basis", "Nachrichten ohne Tokenkosten", "Audio- und Videoanrufe mit Kontakten", "Gruppengalerien"],
  gold: ["Alles aus Premium", "Gold-Bibliothek: Artikel, Interviews, Workshops", "10 € Rabatt auf ein berechtigtes Partyticket je Event"],
};

export default async function Tarif() {
  const { userId, v } = await actingUser();
  const [clock, provider, current] = await Promise.all([
    db.premiumClock.findUnique({ where: { userId } }),
    enabledPaymentProvider(),
    db.subscription.findFirst({ where: { userId, status: { in: ["active", "past_due", "cancel_at_period_end"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const verified = personIdentityVerified(v.person);
  const premiumNow = priceForPeriod("premium", new Date(), clock?.introPriceEndsAt ?? null);
  const introActive = premiumNow === DEFAULT_PRICES.premiumIntroCents;
  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Tarif wählen</h1>
        <Link className="btn ghost small" href="/app/konto">Zum Konto</Link>
      </div>
      {!verified && (
        <Gate reason="Premium und Gold setzen eine abgeschlossene Identitätsprüfung voraus. Zahlung allein schaltet nichts frei." cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />
      )}
      {verified && !provider && <p className="alert warn">Derzeit ist keine Zahlungsart verfügbar. Bitte versuche es später erneut.</p>}
      <div className="grid grid-3">
        {(["basis", "premium", "gold"] as PlanKey[]).map((plan) => {
          const isCurrent = v.person.plan === plan || (plan === "basis" && !current);
          const price = plan === "basis" ? 0 : plan === "gold" ? DEFAULT_PRICES.goldCents : premiumNow;
          return (
            <section key={plan} className={`card plan-card stack ${plan === "premium" ? "featured" : ""}`} aria-labelledby={`p-${plan}`}>
              <h2 id={`p-${plan}`}>{PLAN_LABEL[plan]}</h2>
              <div className="price">{formatCents(price)} <small>/ Monat</small></div>
              {plan === "premium" && (
                <p className="dim" style={{ margin: 0 }}>
                  {introActive
                    ? `Einführungspreis ${formatCents(DEFAULT_PRICES.premiumIntroCents)} für 24 Monate ab deiner ersten Premium- oder Gold-Aktivierung, danach ${formatCents(DEFAULT_PRICES.premiumRegularCents)}. Kündigung und Neubuchung setzen die Frist nicht zurück.`
                    : `Dein Einführungszeitraum ist abgelaufen – regulärer Preis ${formatCents(DEFAULT_PRICES.premiumRegularCents)}.`}
                </p>
              )}
              {plan === "gold" && <p className="dim" style={{ margin: 0 }}>Gold startet ebenfalls die 24-Monats-Frist für den Premium-Einführungspreis.</p>}
              <ul className="checks">{FEATURES[plan].map((f) => <li key={f}>{f}</li>)}</ul>
              {isCurrent ? <span className="badge verified">Dein aktueller Tarif</span>
                : plan !== "basis" && verified && provider ? (
                  <HiddenForm action={startPlanCheckoutAction} fields={{ plan }} submit={`${PLAN_LABEL[plan]} wählen`} submitClass="btn" />
                ) : plan === "basis" && current ? <p className="dim" style={{ margin: 0 }}>Zu Basis wechselst du, indem du im Konto kündigst.</p> : null}
            </section>
          );
        })}
      </div>
      <p className="hint">Alle Preise inkl. USt. Upgrades gelten sofort, Downgrades zum Ende des bezahlten Zeitraums. Abrechnung über {provider?.displayName ?? "einen geprüften Zahlungsanbieter"} – auf dem Kontoauszug erscheint eine neutrale Bezeichnung.</p>
    </div>
  );
}
