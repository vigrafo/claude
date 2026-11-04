"use server";
import { bool, int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { requireRecentReauth } from "@/server/admin/guard";
import { FOUR_EYES_TOKEN_THRESHOLD } from "@/server/tokens";
import { createPackageVersion, requestTokenAdjust, setPackageActive } from "@/server/admin/tokens";

export async function packageVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("tokens.manage", async (a) => {
    const p = await createPackageVersion(a.user.id, { key: str(fd, "key"), tokens: int(fd, "tokens"), priceCents: int(fd, "priceCents"), currency: str(fd, "currency") || "EUR" });
    return { ok: true, message: `Paket ${p.key} v${p.version} angelegt.` };
  });
}

export async function packageActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("tokens.manage", async (a) => {
    await setPackageActive(a.user.id, str(fd, "id"), bool(fd, "active"));
  });
}

export async function tokenAdjustAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("tokens.manage", async (a) => {
    const delta = int(fd, "delta");
    if (Math.abs(delta) > FOUR_EYES_TOKEN_THRESHOLD) requireRecentReauth(a);
    const r = await requestTokenAdjust(a.user.id, str(fd, "handle"), delta, str(fd, "reason"));
    return { ok: true, message: r.status === "pending" ? "Antrag angelegt – eine zweite berechtigte Person muss freigeben." : "Korrektur gebucht." };
  });
}
