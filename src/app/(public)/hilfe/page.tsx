import Link from "next/link";

const FAQ: [string, string][] = [
  ["Wer kann mitmachen?", "Ausschließlich Personen ab 18 Jahren. Profile, Bilder und Beiträge sind nur für angemeldete Mitglieder sichtbar – nie öffentlich und nicht in Suchmaschinen."],
  ["Was bedeutet „Verifiziert“?", "Die Identität aller Personen eines Profils wurde über unseren Verifizierungsanbieter geprüft. Bei Paaren erst, wenn beide Personen geprüft sind. Das ist ein Vertrauenssignal, aber keine Garantie für das Verhalten anderer."],
  ["Was kann ich ohne Verifizierung?", "Profile entdecken, Kontakte gegenseitig freigeben, empfangene Nachrichten kostenlos lesen und mit Tokens schreiben (1 Token je gesendeter Nachricht). Gruppen, Foren, Kennenlernspiele, Premium und Gold setzen die Verifizierung voraus."],
  ["Wie funktioniert die Verifizierung?", "Du wählst Dokumenttyp und Ausstellungsland. Beim Personalausweis fotografierst du Vorder- und Rückseite vollständig und scharf, beim Reisepass die Lichtbild-/Datenseite. Für den Fotoabgleich hältst du das Dokument neben dein Gesicht – nicht davor. Paare: Jede Person verifiziert sich mit dem eigenen Dokument."],
  ["Wie läuft der Premium-Einführungspreis?", "7 € pro Monat für 24 Kalendermonate ab deiner ersten Premium- oder Gold-Buchung, danach 14 €. Kündigung oder Pause verlängern die Frist nicht. Wir informieren dich 30 Tage vorher."],
  ["Was sind Tokens?", "Interne Credits für eigene Nachrichten im Basis-Tarif. Nicht übertragbar, nicht auszahlbar, kein automatischer Nachkauf, kein Verfall. Abgewiesene oder technisch fehlgeschlagene Nachrichten kosten nichts."],
  ["Wie melde oder blockiere ich jemanden?", "Auf jedem Profil, in jeder Nachricht und in jedem Beitrag findest du „Melden“ und „Blockieren“. Blockieren wirkt sofort auf Kontakt, Sichtbarkeit, Spiele und Anrufe."],
  ["Wie lösche ich mein Konto?", "Unter Profil → Datenschutz. Dort kannst du auch deine Daten exportieren."],
];

export default function Hilfe() {
  return (
    <div className="narrow section">
      <h1>Hilfe & FAQ</h1>
      {FAQ.map(([q, a]) => (
        <details key={q} className="card tight" style={{ marginBottom: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>{q}</summary>
          <p className="muted" style={{ marginTop: 10 }}>{a}</p>
        </details>
      ))}
      <p className="muted">Weitere Fragen? <Link href="/kontakt">Schreib uns</Link>.</p>
    </div>
  );
}
