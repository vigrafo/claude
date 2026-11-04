import Link from "next/link";
import type { Metadata } from "next";
import { actingUser } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { IDENTITY_PROVIDERS, SUPPORTED_DOCUMENTS } from "@/server/verification";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { appealVerificationAction, startVerificationAction } from "@/app/actions/member/verification";
import { EUROPE } from "@/domain/countries";

export const metadata: Metadata = { title: "Verifizierung" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; text: string; cls: string }> = {
  not_started: { label: "Noch nicht gestartet", text: "Starte die Identitätsprüfung, um alle Community-Funktionen zu nutzen.", cls: "info" },
  in_progress: { label: "In Bearbeitung", text: "Deine Prüfung läuft beim Anbieter. Schließe die Schritte dort ab.", cls: "info" },
  pending_review: { label: "Manuelle Prüfung", text: "Wir prüfen deinen Fall zusätzlich von Hand. Das dauert in der Regel bis zu zwei Werktage.", cls: "warn" },
  verified: { label: "Verifiziert", text: "Deine Identität und Volljährigkeit sind bestätigt.", cls: "ok" },
  rejected: { label: "Abgelehnt", text: "Die Prüfung war nicht erfolgreich. Du kannst es erneut versuchen oder Widerspruch einlegen.", cls: "error" },
  expired: { label: "Abgelaufen", text: "Deine Verifizierung ist abgelaufen. Bitte prüfe deine Identität erneut.", cls: "warn" },
  revoked: { label: "Entzogen", text: "Deine Verifizierung wurde entzogen. Bei Fragen hilft dir der Support.", cls: "error" },
};

export default async function Verifizierung() {
  const { userId, v } = await actingUser();
  const status = v.user.identityStatus;
  const s = STATUS[status] ?? STATUS.not_started;
  const latest = await db.verificationCase.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  const available = IDENTITY_PROVIDERS.some((p) => p.isAvailable());
  const canStart = ["not_started", "rejected", "expired"].includes(status) && !(latest && ["in_progress", "pending_review"].includes(latest.status));
  const testContinue = latest?.status === "in_progress" && latest.provider === "test" && available;
  const isCouple = v.profileRow?.type === "couple";
  const steps = ["Dokument wählen", "Beim Anbieter prüfen", "Ergebnis"];
  const step = status === "verified" ? 3 : latest && ["in_progress", "pending_review"].includes(latest.status) ? 2 : 1;
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <h1 style={{ margin: 0 }}>Verifizierung</h1>
      <div className={`alert ${s.cls}`} role="status" aria-live="polite">
        <strong>{s.label}.</strong> {s.text}
        {status === "verified" && v.user.identityExpiresAt ? ` Gültig bis ${formatDate(v.user.identityExpiresAt)}.` : ""}
        {latest?.reason && ["rejected", "revoked"].includes(latest.status) ? ` Grund: ${latest.reason}` : ""}
      </div>
      <ol className="row" aria-label="Fortschritt" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {steps.map((t, i) => <li key={t} className={`chip ${i + 1 <= step ? "on" : ""}`} aria-current={i + 1 === step ? "step" : undefined}>{i + 1}. {t}</li>)}
      </ol>

      {testContinue && (
        <p className="alert warn">Testumgebung: <Link href={`/verifizierung/test?case=${latest!.id}&doc=${latest!.documentType ?? ""}`}>Simulierte Prüfung fortsetzen</Link></p>
      )}

      {canStart && (
        <section className="card stack" aria-labelledby="start-h">
          <h2 id="start-h">{status === "not_started" ? "Prüfung starten" : "Erneut versuchen"}</h2>
          {!available ? (
            <p className="alert info" style={{ margin: 0 }}>Die Identitätsprüfung ist derzeit noch nicht angebunden. Wir informieren dich, sobald sie verfügbar ist.</p>
          ) : (
            <ActionForm action={startVerificationAction} submit="Weiter zum Prüfanbieter">
              <fieldset>
                <legend>Dokument</legend>
                {SUPPORTED_DOCUMENTS.map((d, i) => (
                  <label key={d.key} className="check"><input type="radio" name="documentType" value={d.key} defaultChecked={i === 0} /> <span>{d.label} <span className="dim">({d.sides.join(" und ")})</span></span></label>
                ))}
              </fieldset>
              <div className="field">
                <label htmlFor="country">Ausstellendes Land</label>
                <select id="country" name="country" defaultValue={v.profileRow?.regionCountry ?? "DE"}>
                  {EUROPE.map((c) => <option key={c.code} value={c.code}>{c.nameDe}</option>)}
                </select>
              </div>
            </ActionForm>
          )}
        </section>
      )}

      {latest?.status === "rejected" && !latest.appealAt && (
        <section className="card stack" aria-labelledby="appeal-h">
          <h2 id="appeal-h">Widerspruch einlegen</h2>
          <p className="muted" style={{ margin: 0 }}>Du findest, dass die Ablehnung nicht stimmt? Beschreibe kurz, was passiert ist. Ein Mensch prüft den Fall erneut.</p>
          <ActionForm action={appealVerificationAction} submit="Widerspruch senden" submitClass="btn secondary">
            <input type="hidden" name="caseId" value={latest.id} />
            <div className="field">
              <label htmlFor="appeal">Deine Begründung</label>
              <textarea id="appeal" name="text" required minLength={20} rows={4} />
            </div>
          </ActionForm>
        </section>
      )}

      <section className="card stack" aria-labelledby="howto-h">
        <h2 id="howto-h">So gelingt die Prüfung</h2>
        <h3>Personalausweis / ID-Karte / Aufenthaltstitel</h3>
        <ul className="checks">
          <li>Fotografiere die Vorderseite UND die Rückseite.</li>
          <li>Das Dokument muss vollständig, scharf und ohne Spiegelungen zu sehen sein – keine abgeschnittenen Ecken.</li>
          <li>Für den Fotoabgleich hältst du das Dokument NEBEN dein Gesicht, nicht davor.</li>
        </ul>
        <h3>Reisepass</h3>
        <ul className="checks">
          <li>Schlage die Lichtbild-/Datenseite auf und fotografiere die ganze Seite.</li>
          <li>Vermeide Spiegelungen. Ein Reisepass hat keine „Rückseite“ – fotografiere nicht alle Seiten.</li>
          <li>Eine Zusatzseite oder das Auslesen des Chips (NFC) nur, wenn der Prüfanbieter ausdrücklich danach fragt.</li>
        </ul>
        {isCouple && (
          <>
            <h3>Paare</h3>
            <ul className="checks">
              <li>Jede Person verifiziert sich mit ihrem eigenen Dokument und eigenem Login.</li>
              <li>Ihr seht die Dokumente der anderen Person nicht. Das Paarprofil gilt als verifiziert, wenn beide bestätigt sind.</li>
            </ul>
          </>
        )}
        <h3>Was wir speichern</h3>
        <p className="muted" style={{ margin: 0 }}>
          Die Ausweisbilder verarbeitet der Prüfanbieter. Bei eropub bleiben nur minimale Daten: eine pseudonyme Anbieterreferenz, Dokumenttyp und Land, die bestätigte Volljährigkeit, das Ergebnis mit Zeitpunkt und die Gültigkeit.
        </p>
        <p style={{ margin: 0 }}>Probleme? <Link href="/kontakt">Support kontaktieren</Link> · <Link href="/hilfe">Hilfe & FAQ</Link></p>
      </section>
    </div>
  );
}
