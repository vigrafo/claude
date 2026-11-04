import Link from "next/link";
import type { Metadata } from "next";
import { actingUser } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm } from "@/app/app/_components/forms";
import { MfaSetup } from "@/app/app/_components/MfaSetup";
import { changePasswordAction, confirmMfaAction, revokeSessionAction, startMfaAction } from "@/app/actions/member/security";
import { formatDate } from "@/components/ui";

export const metadata: Metadata = { title: "Sicherheit" };

function device(ua: string | null): string {
  if (!ua) return "Unbekanntes Gerät";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Gerät";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} auf ${os}`;
}

export default async function Sicherheit() {
  const { v, userId } = await actingUser();
  const sessions = await db.session.findMany({
    where: { userId, isAdmin: false, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" },
  });
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Sicherheit</h1>
        <Link className="btn ghost small" href="/app/profil">Zurück</Link>
      </div>

      <section className="card" aria-labelledby="pw-h">
        <h2 id="pw-h">Passwort ändern</h2>
        <ActionForm action={changePasswordAction} submit="Passwort ändern" resetOnSuccess>
          <div className="field">
            <label htmlFor="current">Aktuelles Passwort</label>
            <input id="current" name="current" type="password" required autoComplete="current-password" />
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="password">Neues Passwort</label>
              <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" aria-describedby="pw-hint" />
              <p className="hint" id="pw-hint">Mindestens 12 Zeichen.</p>
            </div>
            <div className="field">
              <label htmlFor="password2">Neues Passwort wiederholen</label>
              <input id="password2" name="password2" type="password" required autoComplete="new-password" />
            </div>
          </div>
        </ActionForm>
      </section>

      <section className="card stack" aria-labelledby="mfa-h">
        <h2 id="mfa-h">Zwei-Faktor-Anmeldung (optional)</h2>
        {v.user.mfaEnabledAt ? (
          <p className="alert ok" style={{ margin: 0 }}>Aktiv seit {formatDate(v.user.mfaEnabledAt)}. Beim Login fragen wir zusätzlich nach dem Code aus deiner Authenticator-App.</p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Schützt dein Konto zusätzlich mit einem 6-stelligen Code aus einer Authenticator-App (TOTP).</p>
            <MfaSetup start={startMfaAction} confirm={confirmMfaAction} />
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="ses-h">
        <h2 id="ses-h">Angemeldete Geräte</h2>
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sessions.map((s) => (
            <li key={s.id} className="row between card tight">
              <span>
                <strong>{device(s.userAgent)}</strong>{s.id === v.session.id && <span className="badge verified" style={{ marginLeft: 8 }}>Dieses Gerät</span>}
                <br /><span className="dim">Angemeldet {formatDate(s.createdAt, true)} · zuletzt aktiv {formatDate(s.lastSeenAt, true)}</span>
              </span>
              {s.id !== v.session.id && <HiddenForm action={revokeSessionAction} fields={{ sessionId: s.id }} submit="Abmelden" />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
