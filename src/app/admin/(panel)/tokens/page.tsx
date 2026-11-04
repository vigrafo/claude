import { db } from "@/server/db";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, Reason, ReauthNotice, money, sp, type SP } from "../../_lib/ui";
import { pageArgs } from "@/server/admin/guard";
import { FOUR_EYES_TOKEN_THRESHOLD } from "@/server/tokens";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { packageActiveAction, packageVersionAction, tokenAdjustAction } from "@/app/actions/admin/tokens";
import { approvalDecideAction } from "@/app/actions/admin/roles";

export default async function TokensPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("tokens.manage");
  const params = await searchParams;
  const handle = sp(params, "handle");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const [packages, debts, pending] = await Promise.all([
    db.tokenPackageVersion.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    db.tokenDebt.findMany({ where: { settledAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.pendingApproval.findMany({ where: { kind: "token_correction", approvedBy: null, rejectedBy: null }, orderBy: { createdAt: "asc" } }),
  ]);
  const profile = handle ? await db.communityProfile.findUnique({ where: { handle } }) : null;
  const [ledger, ledgerTotal] = profile
    ? await Promise.all([
        db.tokenLedgerEntry.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, skip, take }),
        db.tokenLedgerEntry.count({ where: { profileId: profile.id } }),
      ])
    : [[], 0];
  const debtProfiles = await db.communityProfile.findMany({ where: { id: { in: [...debts.map((d) => d.profileId), ...pending.map((p) => (p.payload as { profileId: string }).profileId)] } }, select: { id: true, handle: true } });
  const h = (id: string) => debtProfiles.find((p) => p.id === id)?.handle ?? id;

  return (
    <>
      <PageHead title="Tokens">Guthaben gehört zum Profil. Jede Buchung läuft über das unveränderliche Ledger. Korrekturen über {FOUR_EYES_TOKEN_THRESHOLD} Tokens brauchen eine zweite Person.</PageHead>
      <ReauthNotice reauthAt={a.session.reauthAt} next="/admin/tokens" />

      <section className="admin-section">
        <h2>Paketversionen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Paket</th><th>Version</th><th>Tokens</th><th>Preis</th><th>Aktiv</th><th>Erstellt</th><th>Aktion</th></tr></thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.key}</td><td>v{p.version}</td><td>{p.tokens}</td><td>{money(p.priceCents, p.currency)}</td>
                  <td>{p.active ? <span className="badge verified">aktiv</span> : <span className="badge neutral">inaktiv</span>}</td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>
                    <ActionForm action={packageActiveAction} submit={p.active ? "Deaktivieren" : "Aktivieren"} submitClass="btn small secondary">
                      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "false" : "true"} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Verkauft wird je Paketschlüssel die höchste aktive Version. Bestehende Käufe referenzieren ihre Version.</p>
      </section>

      <section className="admin-section card">
        <h2>Neue Paketversion</h2>
        <ActionForm action={packageVersionAction} submit="Version anlegen" resetOnSuccess>
          <Field label="Paketschlüssel (z. B. t20)" name="key" required pattern="[a-z0-9_]{2,20}" />
          <Field label="Tokens" name="tokens" type="number" min={1} required />
          <Field label="Preis (Cent, inkl. USt.)" name="priceCents" type="number" min={50} required />
          <Field label="Währung" name="currency" defaultValue="EUR" />
        </ActionForm>
      </section>

      <section className="admin-section card">
        <h2>Korrektur buchen</h2>
        <ActionForm action={tokenAdjustAction} submit="Korrektur buchen / beantragen" resetOnSuccess>
          <Field label="Profil-Pseudonym" name="handle" required defaultValue={handle} />
          <Field label="Änderung (positiv = Gutschrift, negativ = Abzug)" name="delta" type="number" required />
          <Reason />
        </ActionForm>
      </section>

      <section className="admin-section">
        <h2>Offene Korrekturanträge</h2>
        {pending.length === 0 ? <p className="muted">Keine.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profil</th><th>Änderung</th><th>Begründung</th><th>Am</th><th>Entscheidung</th></tr></thead>
              <tbody>
                {pending.map((p) => {
                  const pl = p.payload as { profileId: string; delta: number; reason: string };
                  return (
                    <tr key={p.id}>
                      <td>{h(pl.profileId)}</td><td>{pl.delta}</td><td>{pl.reason}</td><td>{formatDate(p.createdAt, true)}</td>
                      <td>{p.requestedBy === a.user.id ? <span className="muted">wartet auf zweite Person</span> : (
                        <div className="admin-inline">
                          <ActionForm action={approvalDecideAction} submit="Freigeben" submitClass="btn small"><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
                          <ActionForm action={approvalDecideAction} submit="Ablehnen" submitClass="btn small secondary"><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="reject" /></ActionForm>
                        </div>
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Ledger</h2>
        <form method="get" className="admin-search row">
          <div className="field"><label htmlFor="handle">Profil-Pseudonym</label><input id="handle" name="handle" defaultValue={handle} /></div>
          <button className="btn small" type="submit">Anzeigen</button>
        </form>
        {handle && !profile && <p className="alert info">Profil nicht gefunden.</p>}
        {profile && (
          <>
            <p>Kontostand (Cache): <strong>{profile.tokenBalance}</strong></p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Zeit</th><th>Art</th><th>Änderung</th><th>Saldo danach</th><th>Bezug</th><th>Grund</th></tr></thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id}><td>{formatDate(e.createdAt, true)}</td><td>{e.kind}</td><td>{e.delta > 0 ? `+${e.delta}` : e.delta}</td><td>{e.balanceAfter}</td><td>{e.refType ?? "–"} {e.refId?.slice(0, 8) ?? ""}</td><td>{e.reason ?? "–"}</td></tr>
                  ))}
                  {ledger.length === 0 && <tr><td colSpan={6} className="muted">Keine Buchungen.</td></tr>}
                </tbody>
              </table>
            </div>
            <Pager base="/admin/tokens" params={params} page={page} total={ledgerTotal} />
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>Offene Tokenforderungen (Rückbuchungen)</h2>
        {debts.length === 0 ? <p className="muted">Keine offenen Forderungen.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profil</th><th>Tokens</th><th>Bestellung</th><th>Seit</th></tr></thead>
              <tbody>{debts.map((d) => <tr key={d.id}><td>{h(d.profileId)}</td><td>{d.tokens}</td><td className="admin-mono">{d.orderId}</td><td>{formatDate(d.createdAt)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
