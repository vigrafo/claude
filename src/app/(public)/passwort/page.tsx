import { ActionForm } from "@/components/ActionForm";
import { requestResetAction, resetPasswordAction } from "@/app/actions/auth";

export default async function Passwort({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="narrow section">
      <h1>{token ? "Neues Passwort setzen" : "Passwort vergessen"}</h1>
      <div className="card">
        {token ? (
          <ActionForm action={resetPasswordAction} submit="Passwort speichern">
            <input type="hidden" name="token" value={token} />
            <div className="field"><label htmlFor="pw">Neues Passwort</label><input id="pw" name="password" type="password" minLength={12} required autoComplete="new-password" /></div>
            <div className="field"><label htmlFor="pw2">Wiederholen</label><input id="pw2" name="password2" type="password" required autoComplete="new-password" /></div>
          </ActionForm>
        ) : (
          <ActionForm action={requestResetAction} submit="Link anfordern">
            <div className="field"><label htmlFor="email">E-Mail-Adresse</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
