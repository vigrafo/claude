"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { moveThread, setPostHidden, setThreadFlags } from "@/server/admin/community";

export async function threadFlagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("forums.manage", async (a) => {
    const flag = str(fd, "flag");
    await setThreadFlags(a.user.id, str(fd, "threadId"), flag === "pinned" ? { pinned: bool(fd, "value") } : { locked: bool(fd, "value") });
  });
}

export async function threadMoveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("forums.manage", async (a) => {
    await moveThread(a.user.id, str(fd, "threadId"), str(fd, "categoryId"), str(fd, "reason"));
    return { ok: true, message: "Thema verschoben." };
  });
}

export async function postHiddenAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("forums.manage", async (a) => {
    await setPostHidden(a.user.id, str(fd, "postId"), bool(fd, "hidden"), str(fd, "reason"));
  });
}
