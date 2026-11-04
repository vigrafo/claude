import { SETTING_SCHEMAS, getSetting, type SettingKey } from "@/server/settings";
import { integrationHealth } from "@/server/admin/ops";
import { adminGuard } from "../../_lib/guard";
import { Kpi, PageHead, Reason, TextArea } from "../../_lib/ui";
import { SettingForm } from "../../_lib/SettingForm";
import { ActionForm } from "@/components/ActionForm";
import { settingJsonAction } from "@/app/actions/admin/settings";

const TITLES: Record<SettingKey, string> = {
  features: "Feature-Flags",
  "contact.addresses": "Kontaktadressen",
  "calls.limits": "Anruflimits",
  "uploads.limits": "Upload-Limits",
  ratelimits: "Ratenlimits",
  design: "Design",
  "matching.weights": "Matching-Gewichtungen",
};

export default async function SettingsPage() {
  await adminGuard("settings.manage");
  const health = await integrationHealth();
  const keys = Object.keys(SETTING_SCHEMAS) as SettingKey[];
  const values = await Promise.all(keys.map((k) => getSetting(k)));
  return (
    <>
      <PageHead title="Systemeinstellungen">Alle Einstellungen sind typisiert (zod), versioniert und benötigen einen Änderungsgrund. Kein Shell-Zugriff, kein freies HTML/JS.</PageHead>
      <section className="admin-section">
        <h2>Integrationen</h2>
        <div className="grid grid-3">
          <Kpi label="Datenbank" value={health.db.ok ? `OK · ${health.db.ms} ms` : "Fehler"} />
          <Kpi label="LiveKit (Anrufe)" value={health.livekit ? "konfiguriert" : "nicht konfiguriert"} />
          <Kpi label="E-Mail" value={health.smtpMode} />
          <Kpi label="Zahlungsanbieter aktiv" value={health.providersEnabled.join(", ") || "keiner"} />
          <Kpi label="Identitätsprüfung" value={health.identityProvider.join(", ") || "nicht verfügbar"} />
          <Kpi label="Medienspeicher (S3)" value={health.storage ? "konfiguriert" : "nicht konfiguriert"} />
        </div>
      </section>
      {keys.map((k, i) => (
        <div key={k}>
          <SettingForm settingKey={k} perm="settings.manage" title={TITLES[k] ?? k} />
          <details className="admin-details card" style={{ marginTop: -12 }}>
            <summary>{TITLES[k] ?? k}: als JSON bearbeiten</summary>
            <ActionForm action={settingJsonAction} submit="JSON prüfen & speichern">
              <input type="hidden" name="key" value={k} />
              <TextArea label="Wert (JSON) – wird gegen das Schema validiert" name="json" defaultValue={JSON.stringify(values[i], null, 2)} rows={8} />
              <Reason label="Änderungsgrund" min={3} />
            </ActionForm>
          </details>
        </div>
      ))}
    </>
  );
}
