import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Anmelden" };

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="narrow section">
      <h1>Anmelden</h1>
      <div className="card">
        <ActionForm action={loginAction} submit="Anmelden">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">Passwort</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="otp">Code aus der Authenticator-App <span className="dim">(nur falls aktiviert)</span></label>
            <input id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
          </div>
        </ActionForm>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        <Link href="/passwort">Passwort vergessen?</Link> · Neu hier? <Link href="/registrieren">Kostenlos registrieren</Link>
      </p>
    </div>
  );
}
