import { db } from "@/server/db";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Reason, Select, money, sp, type SP } from "../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { entitlementGrantAction, entitlementRevokeAction, planVersionAction } from "@/app/actions/admin/plans";
import { PLAN_LABEL, firstRegularChargeDate } from "@/domain/plans";
import { activePlan } from "@/server/state";

export default async function TarifePage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("plans.manage");
  const params = await searchParams;
  const lookup = sp(params, "user");
  const versions = await db.planVersion.findMany({ orderBy: [{ plan: "asc" }, { version: "desc" }], include: { _count: { select: { subscriptions: true } } } });
  const user = lookup
    ? await db.user.findFirst({
        where: { OR: [{ id: lookup }, { email: { equals: lookup, mode: "insensitive" } }, { memberships: { some: { profile: { handle: lookup } } } }] },
        include: { premiumClock: true },
      })
    : null;
  const ents = user ? await db.entitlement.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
  const plan = user ? await activePlan(user.id) : null;
  return (
    <>
      <PageHead title="Tarife">Preisversionen sind unveränderlich. Änderungen erzeugen eine neue Version mit Gültigkeit in der Zukunft; bestehende Abos behalten ihre Version.</PageHead>

      <section className="admin-section card">
        <h2>24-Monats-Regel</h2>
        <p>Premium kostet für 24 Kalendermonate ab der <strong>ersten</strong> Premium- oder Gold-Aktivierung einer Person den Einführungspreis, danach den regulären Preis.
          Die Frist (PremiumClock) wird einmalig gesetzt und nie verändert: Kündigung, Pause oder Neubuchung setzen sie nicht zurück und verlängern sie nicht.
          Der höhere Preis gilt ab dem ersten Abrechnungszeitraum, der am oder nach dem Fristende beginnt. Mitglieder werden vorab informiert.</p>
      </section>

      <section className="admin-section">
        <h2>Preisversionen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tarif</th><th>Version</th><th>Preis</th><th>Einführung</th><th>USt.</th><th>Gültig ab</th><th>Gültig bis</th><th>Abos</th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>{PLAN_LABEL[v.plan]}</td><td>v{v.version}</td><td>{money(v.priceCents, v.currency)}</td>
                  <td>{v.introPriceCents != null ? `${money(v.introPriceCents, v.currency)} · ${v.introMonths} Mon.` : "–"}</td>
                  <td>{(v.taxRateBp / 100).toFixed(2)} %</td><td>{formatDate(v.validFrom)}</td><td>{formatDate(v.validTo)}</td><td>{v._count.subscriptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section card">
        <h2>Neue Preisversion</h2>
        <ActionForm action={planVersionAction} submit="Version anlegen" confirm="Neue Preisversion anlegen? Bestehende Versionen bleiben unverändert.">
          <Select label="Tarif" name="plan" options={[{ value: "premium", label: "Premium" }, { value: "gold", label: "Gold" }, { value: "basis", label: "Basis" }]} />
          <Field label="Regulärer Preis (Cent, inkl. USt.)" name="priceCents" type="number" min={0} required />
          <Field label="Einführungspreis (Cent, optional)" name="introPriceCents" type="number" min={0} />
          <Field label="Einführungsdauer (Monate, optional)" name="introMonths" type="number" min={1} max={60} />
          <Field label="Gültig ab (muss in der Zukunft liegen)" name="validFrom" type="datetime-local" required />
        </ActionForm>
      </section>

      <section className="admin-section">
        <h2>Person nachschlagen (Frist & Entitlements)</h2>
        <form method="get" className="admin-search row">
          <div className="field"><label htmlFor="user">Personen-ID, E-Mail oder Pseudonym</label><input id="user" name="user" defaultValue={lookup} /></div>
          <button className="btn small" type="submit">Nachschlagen</button>
        </form>
        {lookup && !user && <p className="alert info">Keine Person gefunden.</p>}
        {user && (
          <div className="card stack">
            <dl className="admin-kv">
              <dt>Person</dt><dd className="admin-mono">{user.id}</dd>
              <dt>Identität</dt><dd>{user.identityStatus}</dd>
              <dt>Aktiver Tarif</dt><dd>{plan && PLAN_LABEL[plan]}</dd>
              <dt>Erste Aktivierung</dt><dd>{user.premiumClock ? formatDate(user.premiumClock.firstPremiumActivatedAt, true) : "noch nie"}</dd>
              <dt>Einführungspreis bis</dt><dd>{user.premiumClock ? formatDate(user.premiumClock.introPriceEndsAt, true) : "–"}</dd>
              <dt>Erste reguläre Abbuchung</dt><dd>{user.premiumClock ? formatDate(firstRegularChargeDate(user.premiumClock.firstPremiumActivatedAt, user.premiumClock.introPriceEndsAt)) : "–"}</dd>
            </dl>
            <h3>Entitlements</h3>
            {ents.length === 0 ? <p className="muted">Keine.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Schlüssel</th><th>Quelle</th><th>Von</th><th>Bis</th><th>Status</th><th>Aktion</th></tr></thead>
                  <tbody>
                    {ents.map((e) => (
                      <tr key={e.id}>
                        <td>{e.key}</td><td className="admin-mono">{e.source}</td><td>{formatDate(e.validFrom)}</td><td>{formatDate(e.validTo)}</td>
                        <td>{e.revokedAt ? "widerrufen" : "aktiv"}</td>
                        <td>{!e.revokedAt && (
                          <ActionForm action={entitlementRevokeAction} submit="Widerrufen" submitClass="btn small danger">
                            <input type="hidden" name="entitlementId" value={e.id} /><Reason />
                          </ActionForm>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3>Entitlement manuell vergeben</h3>
            {user.identityStatus !== "verified" ? (
              <p className="alert warn" role="alert">Blockiert: Diese Person ist nicht identitätsgeprüft. Premium und Gold dürfen ohne abgeschlossene Verifizierung nicht vergeben werden.</p>
            ) : (
              <ActionForm action={entitlementGrantAction} submit="Vergeben">
                <input type="hidden" name="userId" value={user.id} />
                <Select label="Tarif" name="plan" options={[{ value: "premium", label: "Premium" }, { value: "gold", label: "Gold" }]} />
                <Field label="Gültig bis (optional)" name="validTo" type="datetime-local" />
                <Reason />
              </ActionForm>
            )}
          </div>
        )}
      </section>
    </>
  );
}
