import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/server/db";
import { formatEuro } from "@/domain/plans";

export const metadata: Metadata = { title: "Preise" };
export const dynamic = "force-dynamic";

const ROWS: [string, string, string, string][] = [
  ["Voraussetzung", "volljährig; Identitätsprüfung optional für Token-Chat", "vollständig verifiziert", "vollständig verifiziert"],
  ["Profile, Interessen und Kontakte entdecken", "ja", "ja", "ja"],
  ["Kennenlernspiele & Fragen-Matches (Paare)", "ja, kostenlos*", "ja, kostenlos", "ja, kostenlos"],
  ["Gruppen & Foren lesen und mitdiskutieren", "ja*", "ja", "ja"],
  ["Gruppen & Foren beantragen", "ja*", "ja", "ja"],
  ["Empfangene Nachrichten lesen", "kostenlos", "kostenlos", "kostenlos"],
  ["Direktnachrichten senden", "1 Token je Nachricht", "ohne Tokenkosten", "ohne Tokenkosten"],
  ["In-App-Audio- und Videoanrufe", "nein", "ja", "ja"],
  ["Redaktionelle Gold-Inhalte", "nein", "nein", "ja"],
  ["10 € Rabatt auf berechtigte Partytickets", "nein", "nein", "ja"],
  ["Melden, Blockieren, Datenschutz, Kontolöschung", "vollständig", "vollständig", "vollständig"],
];

export default async function Preise() {
  const packages = await db.tokenPackageVersion.findMany({ where: { active: true }, orderBy: { tokens: "asc" } }).catch(() => []);
  return (
    <div className="container section">
      <h1>Tarife</h1>
      <p className="lead muted">Alle Preise in Euro pro Monat, Endpreise inklusive gesetzlicher Umsatzsteuer. Monatlich kündbar zum Ende des Abrechnungszeitraums.</p>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <div className="card plan-card">
          <h2>Basis</h2>
          <div className="price">0 € <small>/ Monat</small></div>
          <p className="muted">Kostenlos entdecken, Kontakte freigeben, empfangene Nachrichten lesen. Senden mit Tokens.</p>
          <Link className="btn secondary" href="/registrieren">Kostenlos starten</Link>
        </div>
        <div className="card plan-card featured">
          <span className="badge plan">Einführungspreis</span>
          <h2 style={{ marginTop: 10 }}>Premium</h2>
          <div className="price">7 € <small>/ Monat in den ersten 24 Monaten</small></div>
          <p className="muted">
            Danach 14 € pro Monat. Die 24 Monate beginnen mit <strong>deiner ersten Premium- oder Gold-Buchung</strong> und werden durch Kündigung,
            Pause oder Neubuchung nicht verlängert oder neu gestartet. Wir informieren dich spätestens 30 Tage vor dem ersten höheren Betrag.
          </p>
          <Link className="btn" href="/app/konto/tarif">Premium wählen</Link>
        </div>
        <div className="card plan-card">
          <h2>Gold</h2>
          <div className="price">25 € <small>/ Monat</small></div>
          <p className="muted">Alles aus Premium, dazu redaktionelle Gold-Inhalte und 10 € Rabatt auf ein berechtigtes Partyticket je Event.</p>
          <Link className="btn secondary" href="/app/konto/tarif">Gold wählen</Link>
        </div>
      </div>

      <h2 style={{ marginTop: 48 }}>Vergleich</h2>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Funktionsvergleich der Tarife</caption>
          <thead><tr><th scope="col">Funktion</th><th scope="col">Basis</th><th scope="col">Premium</th><th scope="col">Gold</th></tr></thead>
          <tbody>
            {ROWS.map(([f, ...v]) => (
              <tr key={f}><th scope="row" style={{ background: "transparent", color: "#fff", position: "static" }}>{f}</th>{v.map((x, i) => <td key={i}>{x}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim" style={{ fontSize: "0.88rem", marginTop: 8 }}>
        * Gruppen, Foren und Kennenlernspiele setzen eine vollständige Identitätsprüfung voraus (bei Paaren: beide Personen). Premium- und
        Gold-Funktionen gelten ebenfalls nur mit abgeschlossener Identitätsprüfung. Paare: Jede Person hat einen eigenen Zugang und eine eigene
        Mitgliedschaft; Tokens gehören zum gemeinsamen Profil.
      </p>

      <h2 style={{ marginTop: 48 }}>Tokens für Basis-Mitglieder</h2>
      <p className="muted">
        Tokens sind interne Nutzungscredits für eigene Direktnachrichten – nicht übertragbar, nicht auszahlbar, ohne Beteiligung anderer Mitglieder.
        Eine gesendete Nachricht (auch eine Antwort oder die erste Kontaktanfrage) kostet 1 Token. Lesen, Melden und Supportkontakte sind kostenlos.
        Kein automatischer Nachkauf, kein Verfall.
      </p>
      <div className="grid grid-3">
        {(packages.length ? packages : [{ id: "a", tokens: 20, priceCents: 500 }, { id: "b", tokens: 40, priceCents: 1000 }, { id: "c", tokens: 100, priceCents: 2500 }]).map((p) => (
          <div className="card" key={p.id}>
            <div className="price">{p.tokens} <small>Tokens</small></div>
            <p className="muted" style={{ margin: 0 }}>{formatEuro(p.priceCents)} · {formatEuro(Math.round(p.priceCents / p.tokens))} je Nachricht</p>
          </div>
        ))}
      </div>
      <div className="alert info" style={{ marginTop: 16 }}>
        Transparent gerechnet: Ab 20 gesendeten Nachrichten im Monat kostet Basis rechnerisch mindestens 5 €. In der Einführungsphase ist
        Premium für 7 € dann meist die günstigere Wahl – sofern deine Identität verifiziert ist.
      </div>
    </div>
  );
}
