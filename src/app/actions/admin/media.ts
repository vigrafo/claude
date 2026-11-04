"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { moderateMedia, setLegalHold } from "@/server/admin/media";

export async function mediaDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("media.moderate", async (a) => {
    await moderateMedia(a.user.id, str(fd, "id"), str(fd, "decision") === "approved" ? "approved" : "rejected", str(fd, "reason"));
  });
}

export async function mediaHoldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("media.moderate", async (a) => {
    await setLegalHold(a.user.id, str(fd, "id"), bool(fd, "hold"), str(fd, "reason"));
  });
}
