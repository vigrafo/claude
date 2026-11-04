"use server";
import { int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { createPlanVersion, grantPlanEntitlement, revokeEntitlement } from "@/server/admin/plans";
import type { PlanKey } from "@/domain/plans";

function optInt(fd: FormData, k: string): number | null {
  return str(fd, k) === "" ? null : int(fd, k);
}

export async function planVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("plans.manage", async (a) => {
    const plan = str(fd, "plan") as PlanKey;
    const validFrom = new Date(str(fd, "validFrom"));
    const v = await createPlanVersion(a.user.id, {
      plan, priceCents: int(fd, "priceCents"), introPriceCents: optInt(fd, "introPriceCents"), introMonths: optInt(fd, "introMonths"), validFrom,
    });
    return { ok: true, message: `Version ${v.version} angelegt.` };
  });
}

export async function entitlementGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("plans.manage", async (a) => {
    const plan = str(fd, "plan");
    if (plan !== "premium" && plan !== "gold") throw new AppError("plan", "Nur Premium oder Gold.");
    const to = str(fd, "validTo");
    await grantPlanEntitlement(a.user.id, str(fd, "userId"), plan, to ? new Date(to) : null, str(fd, "reason"));
    return { ok: true, message: "Entitlement vergeben." };
  });
}

export async function entitlementRevokeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("plans.manage", async (a) => {
    await revokeEntitlement(a.user.id, str(fd, "entitlementId"), str(fd, "reason"));
    return { ok: true, message: "Entitlement widerrufen." };
  });
}
