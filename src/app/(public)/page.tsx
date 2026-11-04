import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container grid grid-2" style={{ alignItems: "center" }}>
          <div>
            <p className="eyebrow">Verifizierte Community ab 18</p>
            <h1>Echte Menschen.<br />Echte Verbindungen.</h1>
            <p className="lead">
              eropub verbindet Singles und Paare, die Offenheit, Respekt und Diskretion schätzen – für Dating, offene Beziehungen,
              Swinger-Community, Stammtische und Events. Mit geprüften Profilen, klaren Regeln und echter Kontrolle über deine Privatsphäre.
            </p>
            <div className="row" style={{ marginTop: 24 }}>
              <Link className="btn" href="/registrieren">Kostenlos registrieren</Link>
              <Link className="btn secondary" href="/preise">Tarife ansehen</Link>
            </div>
            <p className="dim" style={{ marginTop: 16, fontSize: "0.9rem" }}>
              Keine öffentlichen Profile. Keine Suchmaschinen. Nur angemeldete, erwachsene Mitglieder sehen die Community.
            </p>
          </div>
          <div className="card" aria-label="So funktioniert eropub">
            <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Registrieren</strong> – mit Pseudonym, als Single oder Paar mit zwei eigenen Logins.</li>
              <li><strong>Verifizieren</strong> – Identitätsprüfung über einen spezialisierten Anbieter. Dein Badge „Verifiziert“ ist ein Vertrauenssignal.</li>
              <li><strong>Entdecken</strong> – passende Profile über gemeinsame Interessen, Kontaktwünsche und grobe Region.</li>
              <li><strong>Verbinden</strong> – Nachrichten, Kennenlernspiele für Paare, Gruppen, Foren und Events.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid grid-3">
          {[
            ["Verifizierung mit Sinn", "Profile zeigen sichtbar „Verifiziert“ oder „Nicht verifiziert“. Paare sind erst verifiziert, wenn beide Personen geprüft sind."],
            ["Privatsphäre zuerst", "Kontaktfilter, Blockieren, unsichtbarer Online-Status, neutrale Benachrichtigungen und Galeriefreigaben – in jedem Tarif."],
            ["Spielend verbinden", "Paare beantworten gemeinsam kurze, nicht explizite Fragen. Passen 80 % zusammen, gibt es einen Fragen-Match."],
            ["Moderierte Gruppen", "16 offizielle Themenbereiche – von Einvernehmlichkeit bis Reisen. Neue Gruppen werden von eropub geprüft."],
            ["Events & Clubs", "Geprüfte Veranstalter, klare Zugangsregeln, Gold-Mitglieder erhalten 10 € Rabatt auf berechtigte Partytickets."],
            ["Faire Preise", "Basis ist kostenlos. Premium kostet in den ersten 24 Monaten 7 € monatlich, danach 14 €. Gold 25 €."],
          ].map(([t, d]) => (
            <div className="card" key={t}>
              <h3>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container card">
          <h2>Unser Versprechen – ehrlich formuliert</h2>
          <p className="muted">
            Verifizierte Identität ist ein Vertrauenssignal, aber keine Garantie für das Verhalten anderer Menschen. Wir setzen auf geprüfte Profile,
            klare Communityregeln, einfache Meldewege und eine Moderation, die nachvollziehbar entscheidet. Wenn dir etwas komisch vorkommt:
            melden, blockieren, weitergehen – jederzeit und in jedem Tarif.
          </p>
        </div>
      </section>
    </>
  );
}
