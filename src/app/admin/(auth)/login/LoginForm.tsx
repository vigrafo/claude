"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function LoginForm({ login, enrol }: { login: Action; enrol: Action }) {
  const [state, action, pending] = useActionState(login, {} as ActionState);
  const [eState, eAction, ePending] = useActionState(enrol, {} as ActionState);
  const step = (state.data?.step as string | undefined) ?? "login";

  if (step === "enrol" && state.ok) {
    const secret = String(state.data?.secret ?? "");
    const uri = String(state.data?.otpauth ?? "");
    return (
      <form action={eAction} className="stack" noValidate>
        <div aria-live="polite">{eState.error && <div className="alert error" role="alert">{eState.error}</div>}</div>
        <div className="alert info">
          Für die Administration ist eine Zwei-Faktor-Anmeldung Pflicht. Richte jetzt deine Authenticator-App ein
          und bestätige mit dem angezeigten Code. Bewahre das Secret sicher auf – es wird nicht erneut angezeigt.
        </div>
        <div className="field">
          <label htmlFor="secret">Secret (manuelle Eingabe)</label>
          <input id="secret" type="text" readOnly value={secret} className="admin-mono" />
        </div>
        <div className="field">
          <label htmlFor="uri">otpauth-URI</label>
          <textarea id="uri" readOnly value={uri} rows={3} className="admin-mono" />
        </div>
        <div className="field">
          <label htmlFor="code">6-stelliger Code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" required />
        </div>
        <button className="btn" type="submit" disabled={ePending} aria-busy={ePending}>{ePending ? "Bitte warten …" : "MFA aktivieren & anmelden"}</button>
      </form>
    );
  }

  return (
    <form action={action} className="stack" noValidate>
      <div aria-live="polite">{state.error && <div className="alert error" role="alert">{state.error}</div>}</div>
      <div className="field">
        <label htmlFor="email">E-Mail-Adresse</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="otp">Code aus der Authenticator-App</label>
        <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" aria-describedby="otp-hint" />
        <p className="hint" id="otp-hint">Bei der ersten Anmeldung leer lassen – du richtest die App dann ein.</p>
      </div>
      <button className="btn" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Bitte warten …" : "Anmelden"}</button>
    </form>
  );
}
