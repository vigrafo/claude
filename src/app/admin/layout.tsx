import type { Metadata } from "next";
import { clientIp } from "@/lib/viewer";
import { ipAllowed } from "@/server/admin/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

/** Gemeinsame Hülle für /admin: optionale IP-Allowlist (ADMIN_ALLOWED_IPS). Kein Impersonation-Feature. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  if (!ipAllowed(await clientIp())) {
    return (
      <main id="main" className="narrow" style={{ paddingTop: 48 }}>
        <div className="alert error" role="alert">Zugriff auf die Administration ist von dieser IP-Adresse nicht erlaubt.</div>
      </main>
    );
  }
  return <>{children}</>;
}
