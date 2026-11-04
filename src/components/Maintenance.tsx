import { getSetting } from "@/server/settings";

/** Wartungsmodus (Backend: Design/Einstellungen). Admin-Bereich bleibt erreichbar. */
export async function maintenanceScreen() {
  const [features, design] = await Promise.all([getSetting("features"), getSetting("design")]);
  if (!features.maintenanceMode) return null;
  return (
    <main id="main" className="narrow section" style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/eropub-logo.svg" alt="eropub.com" width={220} height={52} />
      <h1 style={{ marginTop: 24 }}>Wartungsarbeiten</h1>
      <p className="muted">{design.maintenanceText}</p>
    </main>
  );
}
