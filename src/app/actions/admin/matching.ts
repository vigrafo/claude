"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { createInterest, setInterestActive, updateInterest } from "@/server/admin/matching";

export async function interestCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("matching.manage", async (a) => {
    await createInterest(a.user.id, { slug: str(fd, "slug"), label: str(fd, "label"), category: str(fd, "category") });
    return { ok: true, message: "Interesse angelegt." };
  });
}

export async function interestUpdateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("matching.manage", async (a) => {
    if (fd.has("active")) await setInterestActive(a.user.id, str(fd, "id"), bool(fd, "active"));
    else await updateInterest(a.user.id, str(fd, "id"), { label: str(fd, "label"), category: str(fd, "category") });
  });
}
