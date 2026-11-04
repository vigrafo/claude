"use server";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { retryOutbox } from "@/server/admin/ops";

export async function outboxRetryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("ops.view", async (a) => {
    await retryOutbox(a.user.id, str(fd, "id"));
    return { ok: true, message: "Erneut eingeplant." };
  });
}
