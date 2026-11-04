import { getSetting, settingHistory, type SettingKey } from "@/server/settings";
import type { PermissionKey } from "@/server/rbac";
import { ActionForm } from "@/components/ActionForm";
import { formatDate } from "@/components/ui";
import { settingFormAction } from "@/app/actions/admin/settings";
import { Field, Reason } from "./ui";

const OPTIONS: Record<string, string[]> = { allowedMime: ["image/jpeg", "image/png", "image/webp"] };

/** Typisiertes Formular für eine Einstellung inkl. Versionshistorie. */
export async function SettingForm({ settingKey, perm, title, labels = {} }: { settingKey: SettingKey; perm: PermissionKey; title: string; labels?: Record<string, string> }) {
  const value = (await getSetting(settingKey)) as Record<string, unknown>;
  const history = await settingHistory(settingKey);
  return (
    <section className="admin-section card">
      <h2>{title}</h2>
      <ActionForm action={settingFormAction} submit="Speichern (neue Version)">
        <input type="hidden" name="key" value={settingKey} />
        <input type="hidden" name="perm" value={perm} />
        {Object.entries(value).map(([k, v]) => {
          const label = labels[k] ?? k;
          if (typeof v === "boolean") return <Field key={k} label={label} name={`v.${k}`} type="checkbox" defaultValue={v ? "1" : ""} />;
          if (typeof v === "number") return <Field key={k} label={label} name={`v.${k}`} type="number" step="any" defaultValue={v} />;
          if (Array.isArray(v)) {
            return (
              <fieldset key={k}>
                <legend>{label}</legend>
                {(OPTIONS[k] ?? (v as string[])).map((o) => (
                  <label key={o} className="check"><input type="checkbox" name={`v.${k}`} value={o} defaultChecked={(v as string[]).includes(o)} /> {o}</label>
                ))}
              </fieldset>
            );
          }
          return <Field key={k} label={label} name={`v.${k}`} defaultValue={String(v)} />;
        })}
        <Reason label="Änderungsgrund" min={3} />
      </ActionForm>
      <details className="admin-details">
        <summary>Versionshistorie ({history.length})</summary>
        {history.length === 0 ? <p className="muted">Noch keine Änderungen – es gelten die Standardwerte.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Version</th><th>Zeit</th><th>Grund</th><th>Wert</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id}><td>v{h.version}</td><td>{formatDate(h.createdAt, true)}</td><td>{h.reason ?? "–"}</td><td className="admin-mono">{JSON.stringify(h.value)}</td></tr>)}</tbody>
          </table></div>
        )}
      </details>
    </section>
  );
}
