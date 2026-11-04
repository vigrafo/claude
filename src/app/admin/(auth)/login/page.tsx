import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { getAdmin } from "@/lib/viewer";
import { adminEnrolAction, adminLoginAction } from "@/app/actions/admin/auth";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main id="main" className="narrow" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <div className="card stack">
        <Logo href="/admin/login" />
        <h1 style={{ fontSize: "1.6rem" }}>Administration</h1>
        <p className="muted">Geschützter Bereich. Anmeldung nur mit Passwort und Zwei-Faktor-Code. Alle Aktionen werden protokolliert.</p>
        <LoginForm login={adminLoginAction} enrol={adminEnrolAction} />
      </div>
    </main>
  );
}
