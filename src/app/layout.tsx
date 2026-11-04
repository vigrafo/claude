import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoBanner } from "@/components/ui";

const indexing = process.env.ALLOW_SEARCH_INDEXING === "true";

export const metadata: Metadata = {
  title: { default: "eropub.com – Echte Menschen. Echte Verbindungen.", template: "%s · eropub.com" },
  description: "Die verifizierte Community für Erwachsene: Dating, offene Beziehungen, Swinger-Community, Gruppen und Events – diskret, respektvoll und einvernehmlich.",
  robots: indexing ? { index: true, follow: true } : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: "/favicon.svg" },
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = { themeColor: "#0b0b0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="with-motif">
        <a href="#main" className="skip">Zum Inhalt springen</a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
