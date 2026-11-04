"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { dissolveCoupleLink, scheduleDeletionNow, setUserStatus } from "@/server/admin/users";

export async function userStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("users.manage", async (a) => {
    const status = str(fd, "status");
    if (!["active", "suspended", "banned"].includes(status)) throw new AppError("status", "Ungültiger Status.");
    await setUserStatus(a.user.id, str(fd, "userId"), status as "active" | "suspended" | "banned", str(fd, "reason"));
    return { ok: true, message: "Status geändert." };
  });
}

export async function dissolveCoupleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("users.manage", async (a) => {
    await dissolveCoupleLink(a.user.id, str(fd, "profileId"), str(fd, "userId"), str(fd, "reason"), bool(fd, "convert"));
    return { ok: true, message: "Paarverknüpfung gelöst." };
  });
}

export async function deletionNowAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("users.manage", async (a) => {
    await scheduleDeletionNow(a.user.id, str(fd, "requestId"), "users.manage");
    return { ok: true, message: "Löschlauf eingeplant – der Worker führt ihn aus." };
  });
}
