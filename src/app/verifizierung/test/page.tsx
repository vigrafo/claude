import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireViewer } from "@/lib/viewer";
import { db } from "@/server/db";
import { ActionForm } from "@/components/ActionForm";
import { simulateVerificationAction } from "@/app/actions/member/simulate";
import { SUPPORTED_DOCUMENTS } from "@/server/verification";

export const metadata: Metadata = { title: "Test-Verifizierung (Simulation)" };
export const dynamic = "force-dynamic";

/** NUR ENTWICKLUNG: Simulierter Identitätsanbieter. In Produktion niemals verfügbar. */
export default async function TestVerifizierung({ searchParams }: { searchParams: Promise<{ case?: string; doc?: string }> }) {
  if (process.env.APP_ENV === "production" || process.env.ENABLE_TEST_ADAPTERS !== "true") notFound();
  const sp = await searchParams;
  const v = await requireViewer();
  const c = sp.case ? await db.verificationCase.findUnique({ where: { id: sp.case } }) : null;
  if (!c || c.userId !== v.user.id || c.provider !== "test") notFound();
  const doc = SUPPORTED_DOCUMENTS.find((d) => d.key === c.documentType);
  const open = c.status === "in_progress";
  const outcomes: [string, string, string][] = [["verified", "Bestätigt (volljährig)", "btn"], ["rejected", "Abgelehnt", "btn danger"], ["needs_review", "Manuelle Prüfung", "btn secondary"]];
  return (
    <main id="main" className="narrow section stack">
      <div role="alert" style={{ background: "#4b2c8a", color: "#fff", padding: "16px", borderRadius: 12, textAlign: "center", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "0.1em" }}>
        SIMULATION – keine echte Identitätsprüfung
      </div>
      <h1>Test-Verifizierung</h1>
      <div className="card stack">
        <p style={{ margin: 0 }}>Dokument: {doc?.label ?? c.documentType} ({c.documentCountry}) · Seiten: {doc?.sides.join(", ") ?? "–"}</p>
        <p className="hint" style={{ margin: 0 }}>Es werden keine Bilder hochgeladen. Die Buttons senden ein signiertes Testergebnis über denselben Weg wie ein echter Anbieter.</p>
      </div>
      {!open ? (
        <p className="alert info">Dieser Fall ist bereits abgeschlossen ({c.status}). <Link href="/app/verifizierung">Zum Status</Link></p>
      ) : (
        <div className="row">
          {outcomes.map(([k, label, cls]) => (
            <ActionForm key={k} action={simulateVerificationAction} submit={label} submitClass={cls}>
              <input type="hidden" name="caseId" value={c.id} />
              <input type="hidden" name="result" value={k} />
            </ActionForm>
          ))}
        </div>
      )}
      <Link href="/app/verifizierung">Zurück zur Verifizierung</Link>
    </main>
  );
}
