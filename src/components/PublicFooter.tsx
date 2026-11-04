import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="footer">
      <div className="container row between">
        <div>
          <strong style={{ color: "#fff" }}>eropub.com</strong> · Echte Menschen. Echte Verbindungen. · Nur für Erwachsene ab 18 Jahren.
        </div>
        <nav className="row" aria-label="Rechtliches">
          <Link href="/seite/community-regeln">Communityregeln</Link>
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/seite/impressum">Impressum</Link>
          <Link href="/seite/datenschutz">Datenschutz</Link>
          <Link href="/seite/agb">Nutzungsbedingungen</Link>
        </nav>
      </div>
    </footer>
  );
}
