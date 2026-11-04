import { db } from "@/server/db";
import { livekitConfigured } from "@/server/calls";
import { adminGuard } from "../../_lib/guard";
import { Kpi, PageHead } from "../../_lib/ui";
import { SettingForm } from "../../_lib/SettingForm";
import { formatDate } from "@/components/ui";

export default async function AnrufePage() {
  await adminGuard("calls.manage");
  const since = new Date(Date.now() - 30 * 86400_000);
  const [byStatus, failures] = await Promise.all([
    db.callSession.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.callSession.findMany({ where: { status: { in: ["failed", "revoked"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, mode: true, status: true, endReason: true, createdAt: true, endedAt: true } }),
  ]);
  return (
    <>
      <PageHead title="Anrufe">Audio/Video über selbst gehostetes LiveKit. Keine Aufzeichnung, kein Mithören – hier nur technische Metadaten.</PageHead>
      <section className="admin-section">
        <div className="grid grid-4">
          <Kpi label="LiveKit konfiguriert" value={livekitConfigured() ? "ja" : "nein"} />
          {byStatus.map((s) => <Kpi key={s.status} label={`${s.status} (30 Tage)`} value={s._count._all} />)}
        </div>
      </section>
      <section className="admin-section">
        <h2>Technische Abbrüche (Metadaten)</h2>
        {failures.length === 0 ? <p className="muted">Keine fehlgeschlagenen oder widerrufenen Anrufe.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Beginn</th><th>Ende</th><th>Modus</th><th>Status</th><th>Grund</th></tr></thead>
            <tbody>{failures.map((f) => <tr key={f.id}><td>{formatDate(f.createdAt, true)}</td><td>{formatDate(f.endedAt, true)}</td><td>{f.mode}</td><td>{f.status}</td><td>{f.endReason ?? "–"}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
      <SettingForm settingKey="calls.limits" perm="calls.manage" title="Anruflimits" labels={{ maxMinutes: "Maximale Dauer (Minuten)", maxCallsPerDay: "Anrufe pro Tag", videoEnabled: "Video erlaubt", maxBitrateKbps: "Max. Bitrate (kbps)", monthlyBudgetCents: "Monatsbudget (Cent, 0 = ohne)" }} />
    </>
  );
}
