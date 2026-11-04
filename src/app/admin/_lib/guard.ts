import "server-only";
import { revalidatePath } from "next/cache";
import { clientIp, requireAdmin, type AdminViewer } from "@/lib/viewer";
import { ipAllowed } from "@/server/admin/guard";
import { forbidden } from "@/server/errors";
import { run, type ActionState } from "@/lib/actions";
import type { PermissionKey } from "@/server/rbac";

/** IP-Allowlist (ADMIN_ALLOWED_IPS) + Adminsitzung mit MFA + Recht. Für Seiten, Actions und Route Handler. */
export async function adminGuard(p?: PermissionKey): Promise<AdminViewer> {
  if (!ipAllowed(await clientIp())) throw forbidden("Zugriff von dieser IP-Adresse nicht erlaubt.");
  return requireAdmin(p);
}

/** Einheitlicher Rahmen für Admin-Server-Actions: Recht prüfen, ausführen, Adminseiten neu laden. */
export async function adminAct(
  perm: PermissionKey,
  fn: (a: AdminViewer) => Promise<ActionState | void>,
  okMessage = "Gespeichert.",
): Promise<ActionState> {
  return run(async () => {
    const a = await adminGuard(perm);
    const r = await fn(a);
    revalidatePath("/admin", "layout");
    return r ?? { ok: true, message: okMessage };
  });
}
