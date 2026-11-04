"use server";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { scheduleDeletionNow } from "@/server/admin/users";

export async function privacyDeletionNowAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("privacy.manage", async (a) => {
    await scheduleDeletionNow(a.user.id, str(fd, "requestId"), "privacy.manage");
    return { ok: true, message: "Löschlauf eingeplant – der Worker führt ihn aus." };
  });
}
