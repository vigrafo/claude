import { db } from "@/server/db";
import { TEMPLATES } from "@/server/mail";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, SearchBar, Select, StatusBadge, sp, type SP } from "../../_lib/ui";
import { SettingForm } from "../../_lib/SettingForm";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { sendTestMailAction } from "@/app/actions/admin/notifications";

const PREVIEW_VARS = { link: "https://eropub.com/…", number: "T-000123", summary: "Beispielvorgang" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("notifications.manage");
  const params = await searchParams;
  const status = sp(params, "status");
  const tpl = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where = { ...(status ? { status } : {}), ...(tpl ? { template: tpl } : {}) };
  const [logs, total] = await Promise.all([db.emailLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }), db.emailLog.count({ where })]);
  const smtp = process.env.MAIL_MODE === "smtp" && !!process.env.SMTP_HOST;
  return (
    <>
      <PageHead title="E-Mail & Benachrichtigungen">Vorlagen sind neutral formuliert: keine Nachrichtentexte, keine intimen Inhalte, keine Ausweisdaten.</PageHead>
      <p className={`alert ${smtp ? "ok" : "info"}`}>Versandmodus: {smtp ? "SMTP (echter Versand)" : "Log – es werden keine echten E-Mails versendet"}.</p>
      <section className="admin-section">
        <h2>Vorlagen (nur Lesen)</h2>
        <div className="grid grid-2">
          {Object.entries(TEMPLATES).map(([k, t]) => (
            <div key={k} className="card tight">
              <div className="dim admin-mono">{k}</div>
              <strong>{t.subject}</strong>
              <div className="admin-pre" style={{ marginTop: 8 }}>{t.text(PREVIEW_VARS)}</div>
            </div>
          ))}
        </div>
      </section>
      <SettingForm settingKey="contact.addresses" perm="notifications.manage" title="Kontaktadressen" labels={{ admin: "Verwaltung", contact: "Kontakt (Standard: contakt@eropub.com)", info: "Info" }} />
      <section className="admin-section card">
        <h2>Testversand</h2>
        {!smtp ? <p className="muted">Nicht verfügbar: Testversand nur mit MAIL_MODE=smtp und konfiguriertem SMTP-Server.</p> : (
          <ActionForm action={sendTestMailAction} submit="Testnachricht senden">
            <Select label="Vorlage" name="template" options={Object.keys(TEMPLATES)} />
            <Field label="Empfänger" name="to" type="email" required />
            <Field label="Ich bestätige den echten Versand an diese Adresse." name="confirm" type="checkbox" />
          </ActionForm>
        )}
      </section>
      <section className="admin-section">
        <h2>Versandprotokoll</h2>
        <SearchBar base="/admin/benachrichtigungen" q={tpl} params={params} placeholder="Vorlage (exakt, z. B. verify_email)" filters={[{ name: "status", label: "Status", options: ["queued", "sent", "failed", "suppressed"].map((s) => ({ value: s, label: s })) }]} />
        {logs.length === 0 ? <Empty title="Keine Einträge" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Zeit</th><th>Vorlage</th><th>Empfänger (Hash)</th><th>Status</th><th>Fehler</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td>{formatDate(l.createdAt, true)}</td><td>{l.template}</td><td className="admin-mono">{l.toHash.slice(0, 16)}…</td><td><StatusBadge status={l.status} /></td><td>{l.error ?? "–"}</td></tr>)}</tbody>
          </table></div>
        )}
        <Pager base="/admin/benachrichtigungen" params={params} page={page} total={total} />
      </section>
    </>
  );
}
