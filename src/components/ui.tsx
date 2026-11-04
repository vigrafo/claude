import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="eropub.com Startseite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/eropub-logo.svg" alt="eropub.com" width={154} height={36} />
    </Link>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge verified" title="Identität aller Personen dieses Profils geprüft">
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
      Verifiziert
    </span>
  ) : (
    <span className="badge unverified" title="Identitätsprüfung nicht abgeschlossen">Nicht verifiziert</span>
  );
}

export function Avatar({ name, size, photoId }: { name: string; size?: "lg"; photoId?: string | null }) {
  if (photoId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`avatar ${size ?? ""}`} src={`/app/medien/${photoId}`} alt={`Profilbild von ${name}`} loading="lazy" />;
  }
  return <span className={`avatar ${size ?? ""}`} aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 36 }}>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Gate({ reason, cta }: { reason: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card" role="note">
      <h2>Noch gesperrt</h2>
      <p className="muted">{reason}</p>
      {cta && <Link className="btn" href={cta.href}>{cta.label}</Link>}
    </div>
  );
}

export function Icon({ name }: { name: "discover" | "messages" | "community" | "events" | "profile" }) {
  const paths: Record<string, string> = {
    discover: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 6.5-2 5-5 2 2-5 5-2z",
    messages: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z",
    community: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2.1 2.1 2.1 3.9v2h7v-2c0-2.7-5.3-4-8-4z",
    events: "M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 8h14v10H5V10z",
    profile: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z",
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={paths[name]} /></svg>
  );
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "Europe/Berlin" }).format(new Date(d));
}

export function DemoBanner() {
  if (process.env.APP_ENV === "production") return null;
  return (
    <div style={{ background: "#2b1a52", color: "#fff", textAlign: "center", fontSize: "0.85rem", padding: "6px 12px" }} role="note">
      Entwicklungs-/Testumgebung – Zahlungen, Verifizierung und E-Mail sind simuliert. Suchmaschinen sind gesperrt.
    </div>
  );
}
