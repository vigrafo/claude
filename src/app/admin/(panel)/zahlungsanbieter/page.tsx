import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { PROVIDER_CATALOG } from "@/server/payments/catalog";
import { enableCheck } from "@/server/admin/providers";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, ReauthNotice, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { providerEnableAction, providerModeAction, providerSecretAction, providerSettingsAction } from "@/app/actions/admin/providers";

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("providers.manage");
  const params = await searchParams;
  const st = sp(params, "status");
  const prov = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const configs = await db.providerConfiguration.findMany({ orderBy: [{ priority: "desc" }, { key: "asc" }] });
  const where: Prisma.WebhookEventWhereInput = {};
  if (st) where.status = st;
  if (prov) where.provider = prov;
  const [events, total] = await Promise.all([
    db.webhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, skip, take, select: { id: true, provider: true, eventId: true, type: true, signatureOk: true, status: true, error: true, attempts: true, receivedAt: true } }),
    db.webhookEvent.count({ where }),
  ]);
  return (
    <>
      <PageHead title="Zahlungsanbieter">Status und Eignung kommen aus dem Code-Katalog. Nur implementierte und konfigurierte Adapter sind aktivierbar. Secrets werden verschlüsselt gespeichert und nie im Klartext angezeigt.</PageHead>
      <ReauthNotice reauthAt={a.session.reauthAt} next="/admin/zahlungsanbieter" />
      {configs.map((c) => {
        const entry = PROVIDER_CATALOG.find((p) => p.key === c.key);
        const chk = entry ? enableCheck(c.key, c.mode) : { ok: false, reason: "Nicht im Katalog." };
        return (
          <section key={c.id} className="card admin-section">
            <div className="row between">
              <h2 style={{ margin: 0 }}>{c.displayName}</h2>
              <div className="row">
                <StatusBadge status={entry?.implStatus ?? c.implStatus} />
                <span className="badge neutral">{entry?.eligibility ?? c.eligibility}</span>
                <span className="badge neutral">Modus: {c.mode}</span>
                {c.enabled ? <span className="badge verified">aktiv</span> : <span className="badge neutral">inaktiv</span>}
              </div>
            </div>
            <dl className="admin-kv" style={{ marginTop: 12 }}>
              <dt>Fähigkeiten</dt><dd>{entry?.capabilities.join(", ") || "–"}</dd>
              <dt>Methoden (Katalog)</dt><dd>{entry?.methods.join(", ") || "–"}</dd>
              <dt>Hinweise</dt><dd>{entry?.notes ?? c.notes ?? "–"}</dd>
              <dt>Secret</dt><dd>{c.secretHint ?? "nicht hinterlegt"}</dd>
              <dt>Webhook</dt><dd>{c.webhookLastAt ? `zuletzt ${formatDate(c.webhookLastAt, true)} · ${c.webhookHealthy ? "gesund" : "auffällig"}` : "noch kein Webhook empfangen"}</dd>
              <dt>Aktivierbar ({c.mode})</dt><dd>{chk.ok ? "ja" : `nein – ${chk.reason}`}</dd>
            </dl>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div className="stack">
                <ActionForm action={providerEnableAction} submit={c.enabled ? "Deaktivieren" : "Aktivieren"} submitClass={c.enabled ? "btn secondary" : "btn"}>
                  <input type="hidden" name="key" value={c.key} /><input type="hidden" name="enabled" value={c.enabled ? "false" : "true"} />
                </ActionForm>
                <ActionForm action={providerModeAction} submit={c.mode === "live" ? "Auf Sandbox umstellen" : "Auf Live umstellen"} submitClass="btn secondary" confirm="Modus wechseln?">
                  <input type="hidden" name="key" value={c.key} /><input type="hidden" name="mode" value={c.mode === "live" ? "sandbox" : "live"} />
                  {entry?.implStatus !== "implemented" && c.mode !== "live" && <p className="hint">Live ist für diesen Adapter gesperrt ({entry?.implStatus}).</p>}
                </ActionForm>
              </div>
              <details className="admin-details">
                <summary>Einstellungen & Secret</summary>
                <ActionForm action={providerSettingsAction} submit="Einstellungen speichern">
                  <input type="hidden" name="key" value={c.key} />
                  <Field label="Priorität (höher = bevorzugt)" name="priority" type="number" defaultValue={c.priority} />
                  <Field label="Länder (ISO, kommagetrennt; leer = alle)" name="countries" defaultValue={c.countries.join(", ")} />
                  <Field label="Währungen" name="currencies" defaultValue={c.currencies.join(", ")} />
                  <Field label="Zahlungsmethoden" name="methods" defaultValue={c.methods.join(", ")} />
                </ActionForm>
                <hr />
                <ActionForm action={providerSecretAction} submit="Secret speichern" resetOnSuccess>
                  <input type="hidden" name="key" value={c.key} />
                  <Field label="Neues Secret / API-Schlüssel" name="secret" type="password" autoComplete="off" hint="Wird nur verschlüsselt gespeichert. Erfordert frische Re-Authentifizierung." />
                </ActionForm>
                {c.secretHint && (
                  <ActionForm action={providerSecretAction} submit="Secret löschen" submitClass="btn small danger" confirm="Secret löschen und Anbieter deaktivieren?">
                    <input type="hidden" name="key" value={c.key} /><input type="hidden" name="clear" value="true" />
                  </ActionForm>
                )}
              </details>
            </div>
          </section>
        );
      })}

      <section className="admin-section">
        <h2>Webhook-Ereignisse</h2>
        <SearchBar base="/admin/zahlungsanbieter" q={prov} params={params} placeholder="Anbieter (z. B. ccbill)" filters={[
          { name: "status", label: "Status", options: ["received", "processed", "rejected", "failed"].map((s) => ({ value: s, label: s })) },
        ]} />
        {events.length === 0 ? <p className="muted">Keine Ereignisse.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Zeit</th><th>Anbieter</th><th>Typ</th><th>Signatur</th><th>Status</th><th>Fehler</th><th>Versuche</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.receivedAt, true)}</td><td>{e.provider}</td><td>{e.type}</td><td>{e.signatureOk ? "ok" : "ungültig"}</td>
                    <td><StatusBadge status={e.status} /></td><td>{e.error ?? "–"}</td><td>{e.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager base="/admin/zahlungsanbieter" params={params} page={page} total={total} />
      </section>
    </>
  );
}
