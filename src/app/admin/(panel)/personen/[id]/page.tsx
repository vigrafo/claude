import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { activePlan } from "@/server/state";
import { adminGuard } from "../../../_lib/guard";
import { PageHead, Reason, Select, StatusBadge, Field } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { dissolveCoupleAction, userStatusAction } from "@/app/actions/admin/users";
import { PLAN_LABEL } from "@/domain/plans";

export default async function PersonDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await adminGuard("users.read");
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      memberships: { include: { profile: { include: { memberships: { where: { status: "active" } } } } }, orderBy: { createdAt: "asc" } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 5 },
      premiumClock: true,
      roleAssignments: { where: { revokedAt: null }, include: { role: true } },
      deletionRequests: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!u) notFound();
  const [plan, ents] = await Promise.all([
    activePlan(u.id),
    db.entitlement.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const manage = a.has("users.manage");
  return (
    <>
      <PageHead title="Person">
        <Link href="/admin/personen">← Zurück zur Liste</Link>
      </PageHead>
      <section className="card">
        <dl className="admin-kv">
          <dt>ID</dt><dd className="admin-mono">{u.id}</dd>
          <dt>E-Mail</dt><dd>{manage ? u.email : "verborgen (users.manage erforderlich)"}</dd>
          <dt>Status</dt><dd><StatusBadge status={u.status} /></dd>
          <dt>Identität</dt><dd><StatusBadge status={u.identityStatus} /> {u.identityVerifiedAt && `seit ${formatDate(u.identityVerifiedAt)}`} {u.identityExpiresAt && `· gültig bis ${formatDate(u.identityExpiresAt)}`}</dd>
          <dt>Volljährigkeit</dt><dd>Selbstauskunft: {u.adultConfirmedAt ? formatDate(u.adultConfirmedAt) : "nein"} · Anbieter: {u.ageAssuredAt ? formatDate(u.ageAssuredAt) : "nein"}</dd>
          <dt>Tarif (aktiv)</dt><dd><span className="badge plan">{PLAN_LABEL[plan]}</span></dd>
          <dt>24-Monats-Frist</dt><dd>{u.premiumClock ? `erste Aktivierung ${formatDate(u.premiumClock.firstPremiumActivatedAt)} · Einführungspreis bis ${formatDate(u.premiumClock.introPriceEndsAt)}` : "noch nie Premium/Gold"}</dd>
          <dt>MFA</dt><dd>{u.mfaEnabledAt ? `aktiv seit ${formatDate(u.mfaEnabledAt)}` : "nicht eingerichtet"}</dd>
          <dt>Rollen</dt><dd>{u.roleAssignments.map((r) => r.role.name + (r.scopeType ? ` (${r.scopeType})` : "")).join(", ") || "–"}</dd>
          <dt>Registriert</dt><dd>{formatDate(u.createdAt, true)}</dd>
        </dl>
      </section>

      <section className="admin-section">
        <h2>Profile & Paarverknüpfung</h2>
        {u.memberships.length === 0 ? <p className="muted">Keine Profile.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profil</th><th>Typ</th><th>Profilstatus</th><th>Mitgliedschaft</th><th>Aktive Personen</th><th>Tokens</th>{manage && <th>Aktion</th>}</tr></thead>
              <tbody>
                {u.memberships.map((m) => (
                  <tr key={m.id}>
                    <td>{m.profile.handle} {m.profile.verifiedBadge && <span className="badge verified">Verifiziert</span>}</td>
                    <td>{m.profile.type}</td>
                    <td><StatusBadge status={m.profile.status} /></td>
                    <td>{m.status} · {m.role}{m.displayLabel ? ` · „${m.displayLabel}“` : ""}</td>
                    <td>{m.profile.memberships.length}</td>
                    <td>{m.profile.tokenBalance}</td>
                    {manage && <td>{m.profile.type === "couple" && m.status === "active" ? (
                      <ActionForm action={dissolveCoupleAction} submit="Paarverknüpfung lösen" submitClass="btn small danger" confirm="Person aus dem Paarprofil entfernen?">
                        <input type="hidden" name="profileId" value={m.profileId} />
                        <input type="hidden" name="userId" value={u.id} />
                        <Reason />
                        <Field label="Verbleibende Person als Einzelprofil weiterführen" name="convert" type="checkbox" />
                      </ActionForm>
                    ) : "–"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Abos & Berechtigungen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Art</th><th>Schlüssel</th><th>Status/Quelle</th><th>Zeitraum</th></tr></thead>
            <tbody>
              {u.subscriptions.map((s) => (
                <tr key={s.id}><td>Abo</td><td>{PLAN_LABEL[s.plan]}</td><td><StatusBadge status={s.status} /> {s.provider}</td><td>{formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}</td></tr>
              ))}
              {ents.map((e) => (
                <tr key={e.id}><td>Entitlement</td><td>{e.key}</td><td>{e.source}{e.revokedAt ? " · widerrufen" : ""}</td><td>{formatDate(e.validFrom)} – {formatDate(e.validTo)}</td></tr>
              ))}
              {u.subscriptions.length + ents.length === 0 && <tr><td colSpan={4} className="muted">Keine Abos oder Berechtigungen.</td></tr>}
            </tbody>
          </table>
        </div>
        {a.has("plans.manage") && <p><Link href={`/admin/tarife?user=${u.id}`}>Entitlement korrigieren →</Link></p>}
      </section>

      {manage && u.status !== "deleted" && (
        <section className="admin-section card">
          <h2>Kontostatus ändern</h2>
          <p className="muted">Bei Sperre/Bann werden alle Sitzungen widerrufen, laufende Spiele und Anrufe beendet.</p>
          <ActionForm action={userStatusAction} submit="Status setzen" submitClass="btn danger" confirm="Status wirklich ändern?">
            <input type="hidden" name="userId" value={u.id} />
            <Select label="Neuer Status" name="status" defaultValue={u.status === "active" ? "suspended" : "active"} options={[
              { value: "active", label: "aktiv (entsperren)" }, { value: "suspended", label: "gesperrt" }, { value: "banned", label: "gebannt" },
            ]} />
            <Reason />
          </ActionForm>
        </section>
      )}

      <section className="admin-section">
        <h2>Löschanträge</h2>
        {u.deletionRequests.length === 0 ? <p className="muted">Keine.</p> : (
          <ul>{u.deletionRequests.map((d) => <li key={d.id}>{d.status} · geplant {formatDate(d.scheduledFor, true)}</li>)}</ul>
        )}
      </section>
    </>
  );
}
