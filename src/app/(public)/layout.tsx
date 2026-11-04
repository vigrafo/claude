import Link from "next/link";
import { Logo } from "@/components/ui";
import { getViewer } from "@/lib/viewer";
import { PublicFooter } from "@/components/PublicFooter";
import { maintenanceScreen } from "@/components/Maintenance";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const m = await maintenanceScreen();
  if (m) return m;
  const v = await getViewer();
  return (
    <>
      <header className="site-header">
        <div className="container bar">
          <Logo />
          <nav className="topnav" aria-label="Hauptnavigation">
            <Link href="/preise">Preise</Link>
            <Link href="/hilfe">Hilfe</Link>
            {v ? (
              <Link className="btn small" href="/app">Zur Community</Link>
            ) : (
              <>
                <Link href="/anmelden">Anmelden</Link>
                <Link className="btn small" href="/registrieren">Kostenlos registrieren</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <PublicFooter />
    </>
  );
}
