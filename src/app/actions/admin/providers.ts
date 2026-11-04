"use server";
import { bool, int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { requireRecentReauth } from "@/server/admin/guard";
import { clearProviderSecret, setProviderEnabled, setProviderMode, setProviderSecret, updateProviderSettings } from "@/server/admin/providers";

export async function providerEnableAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("providers.manage", async (a) => {
    await setProviderEnabled(a.user.id, str(fd, "key"), bool(fd, "enabled"));
  });
}

export async function providerModeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("providers.manage", async (a) => {
    requireRecentReauth(a);
    await setProviderMode(a.user.id, str(fd, "key"), str(fd, "mode") === "live" ? "live" : "sandbox");
    return { ok: true, message: "Modus geändert. Der Anbieter ist vorsorglich deaktiviert – bitte Aktivierung erneut prüfen." };
  });
}

export async function providerSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("providers.manage", async (a) => {
    await updateProviderSettings(a.user.id, str(fd, "key"), { priority: int(fd, "priority"), countries: str(fd, "countries"), currencies: str(fd, "currencies"), methods: str(fd, "methods") });
  });
}

export async function providerSecretAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("providers.manage", async (a) => {
    requireRecentReauth(a);
    if (bool(fd, "clear")) await clearProviderSecret(a.user.id, str(fd, "key"));
    else await setProviderSecret(a.user.id, str(fd, "key"), String(fd.get("secret") ?? ""));
    return { ok: true, message: "Secret gespeichert (verschlüsselt). Angezeigt wird nur der Hinweis." };
  });
}
