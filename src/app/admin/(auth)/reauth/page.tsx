import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getAdmin } from "@/lib/viewer";
import { adminReauthAction } from "@/app/actions/admin/auth";
import { safeAdminNext } from "@/server/admin/session";
import { REAUTH_MINUTES } from "@/server/auth";

export default async function ReauthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  const next = safeAdminNext((await searchParams).next);
  return (
    <main id="main" className="narrow" style={{ paddingTop: 48 }}>
      <div className="card stack">
        <h1 style={{ fontSize: "1.5rem" }}>Erneut bestätigen</h1>
        <p className="muted">
          Für sensible Aktionen (Secrets, Exporte, Rollenvergabe, große Korrekturen) bestätigst du dich mit deinem Code.
          Die Freigabe gilt {REAUTH_MINUTES} Minuten.
        </p>
        <ActionForm action={adminReauthAction} submit="Bestätigen">
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="code">Code aus der Authenticator-App</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </div>
        </ActionForm>
        <a href={next}>Abbrechen</a>
      </div>
    </main>
  );
}
