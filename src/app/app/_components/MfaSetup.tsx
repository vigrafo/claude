"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Zweistufige TOTP-Einrichtung: Secret erzeugen → Code bestätigen. */
export function MfaSetup({ start, confirm }: { start: Action; confirm: Action }) {
  const [s1, a1, p1] = useActionState(start, {} as ActionState);
  const [s2, a2, p2] = useActionState(confirm, {} as ActionState);
  const secret = typeof s1.data?.secret === "string" ? s1.data.secret : null;
  const uri = typeof s1.data?.otpauth === "string" ? s1.data.otpauth : null;
  if (s2.ok) return <div className="alert ok" role="status">{s2.message}</div>;
  return (
    <div className="stack">
      <form action={a1}>
        <div aria-live="polite">{s1.error && <div className="alert error" role="alert">{s1.error}</div>}</div>
        <button className="btn secondary" type="submit" disabled={p1}>{secret ? "Neuen Schlüssel erzeugen" : "Zwei-Faktor-Anmeldung einrichten"}</button>
      </form>
      {secret && uri && (
        <form action={a2} className="stack">
          <p className="muted">Füge den Schlüssel in deiner Authenticator-App hinzu (z. B. über „Schlüssel manuell eingeben“) oder nutze den Einrichtungslink.</p>
          <div className="field">
            <label htmlFor="mfa-secret">Schlüssel</label>
            <input id="mfa-secret" type="text" readOnly value={secret} />
          </div>
          <div className="field">
            <label htmlFor="mfa-uri">Einrichtungslink (otpauth)</label>
            <input id="mfa-uri" type="text" readOnly value={uri} />
          </div>
          <input type="hidden" name="secret" value={secret} />
          <div className="field">
            <label htmlFor="mfa-code">6-stelliger Code aus der App</label>
            <input id="mfa-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required />
          </div>
          <div aria-live="polite">{s2.error && <div className="alert error" role="alert">{s2.error}</div>}</div>
          <button className="btn" type="submit" disabled={p2}>Aktivieren</button>
        </form>
      )}
    </div>
  );
}
