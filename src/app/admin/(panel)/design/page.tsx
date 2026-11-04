import { getSetting, settingHistory } from "@/server/settings";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Reason } from "../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { maintenanceToggleAction, settingFormAction } from "@/app/actions/admin/settings";
import { DesignForm } from "./DesignForm";
import Link from "next/link";

export default async function DesignPage() {
  const a = await adminGuard("design.manage");
  const [design, features, history] = await Promise.all([getSetting("design"), getSetting("features"), settingHistory("design")]);
  return (
    <>
      <PageHead title="Design & Kontaktangaben">Akzentfarbe, Claim und Wartungstext. Kein freies HTML/JS. Kontaktadressen pflegt der Bereich E-Mail{a.has("notifications.manage") ? <> (<Link href="/admin/benachrichtigungen">öffnen</Link>)</> : ""}.</PageHead>
      <section className="admin-section card">
        <h2>Design</h2>
        <DesignForm action={settingFormAction} initial={design} />
        <details className="admin-details">
          <summary>Versionshistorie ({history.length})</summary>
          <ul>{history.map((h) => <li key={h.id}>v{h.version} · {formatDate(h.createdAt, true)} · {h.reason ?? "–"} · <span className="admin-mono">{JSON.stringify(h.value)}</span></li>)}</ul>
        </details>
      </section>
      <section className="admin-section card">
        <h2>Wartungsmodus</h2>
        <p>Aktuell: <strong>{features.maintenanceMode ? "eingeschaltet" : "ausgeschaltet"}</strong></p>
        <ActionForm action={maintenanceToggleAction} submit={features.maintenanceMode ? "Wartungsmodus ausschalten" : "Wartungsmodus einschalten"} submitClass={features.maintenanceMode ? "btn" : "btn danger"} confirm="Wartungsmodus umschalten?">
          <input type="hidden" name="on" value={features.maintenanceMode ? "false" : "true"} />
          <Reason min={3} />
        </ActionForm>
      </section>
    </>
  );
}
