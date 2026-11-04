"use server";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { requireRecentReauth } from "@/server/admin/guard";
import { requestRoleGrant, revokeAdminSession, revokeRole } from "@/server/admin/roles";
import { approvePending, rejectPending } from "@/server/admin/approvals";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";

export async function roleGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("roles.manage", async (a) => {
    requireRecentReauth(a);
    const r = await requestRoleGrant(a.user.id, str(fd, "email"), str(fd, "role"), str(fd, "reason"));
    return { ok: true, message: r.status === "pending" ? "Kritische Rolle: Antrag angelegt – eine zweite berechtigte Person muss freigeben." : "Rolle vergeben." };
  });
}

export async function roleRevokeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("roles.manage", async (a) => {
    requireRecentReauth(a);
    await revokeRole(a.user.id, str(fd, "assignmentId"), str(fd, "reason"));
    return { ok: true, message: "Rolle entzogen, Adminsitzungen der Person beendet." };
  });
}

/** Freigabe/Ablehnung von Vier-Augen-Anträgen (Rollen & Tokenkorrekturen). Recht wird je Antragsart im Service geprüft. */
export async function approvalDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "approvalId");
  const p = await db.pendingApproval.findUnique({ where: { id } });
  const perm = p?.kind === "token_correction" ? "tokens.manage" : "roles.manage";
  return adminAct(perm, async (a) => {
    if (!p) throw new AppError("not_found", "Antrag nicht gefunden.", 404);
    requireRecentReauth(a);
    if (str(fd, "decision") === "approve") await approvePending(id, a.user.id);
    else await rejectPending(id, a.user.id);
    return { ok: true, message: "Entscheidung gespeichert." };
  });
}

export async function adminSessionRevokeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("roles.manage", async (a) => {
    await revokeAdminSession(a.user.id, str(fd, "sessionId"));
    return { ok: true, message: "Sitzung beendet." };
  });
}
