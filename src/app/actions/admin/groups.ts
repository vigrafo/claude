"use server";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { decideGroup, decideModeratorApplication, revokeModerator } from "@/server/community";
import { createOfficialGroup, updateGroupSettings } from "@/server/admin/community";
import { audit } from "@/server/audit";

export async function groupDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("groups.manage", async (a) => {
    const s = str(fd, "status");
    if (!["approved", "rejected", "suspended", "archived"].includes(s)) throw new AppError("status", "Ungültiger Status.");
    if (s !== "approved" && str(fd, "note").length < 3) throw new AppError("note", "Bitte eine Begründung angeben.");
    await decideGroup(a.user.id, str(fd, "groupId"), s as "approved", str(fd, "note") || undefined);
  });
}

export async function groupSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("groups.manage", async (a) => {
    await updateGroupSettings(a.user.id, str(fd, "groupId"), { rules: String(fd.get("rules") ?? ""), visibility: str(fd, "visibility"), description: String(fd.get("description") ?? "") });
  });
}

export async function groupCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("groups.manage", async (a) => {
    await createOfficialGroup(a.user.id, { name: str(fd, "name"), description: String(fd.get("description") ?? ""), category: str(fd, "category"), visibility: str(fd, "visibility"), rules: String(fd.get("rules") ?? "") });
    return { ok: true, message: "Offizielle Gruppe angelegt und freigegeben." };
  });
}

export async function modApplicationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("groups.manage", async (a) => {
    await decideModeratorApplication(a.user.id, str(fd, "applicationId"), str(fd, "decision") === "approve");
  });
}

export async function modRevokeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("groups.manage", async (a) => {
    const reason = str(fd, "reason");
    if (reason.length < 5) throw new AppError("reason", "Bitte eine Begründung angeben (mind. 5 Zeichen).");
    await revokeModerator(a.user.id, str(fd, "groupId"), str(fd, "userId"));
    await audit("group.moderator_revoke_reason", { actorUserId: a.user.id, targetType: "group", targetId: str(fd, "groupId"), meta: { reason } });
    return { ok: true, message: "Moderationsrolle entzogen." };
  });
}
