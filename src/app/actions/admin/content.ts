"use server";
import { bool, int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { createGoldContent, GOLD_STATUSES, saveGoldContent, savePublicPage, transitionGoldContent, updateDiscountRule, type GoldInput, type GoldStatus } from "@/server/admin/content";
import { redirect } from "next/navigation";

function gold(fd: FormData): GoldInput {
  return {
    slug: str(fd, "slug"), title: str(fd, "title"), kind: str(fd, "kind"), category: str(fd, "category"), summary: str(fd, "summary"),
    body: String(fd.get("body") ?? ""), rightsProof: str(fd, "rightsProof"), mediaKey: str(fd, "mediaKey"),
  };
}

export async function goldCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await adminAct("content.manage", async (a) => {
    id = (await createGoldContent(a.user.id, gold(fd))).id;
  });
  if (r.ok && id) redirect(`/admin/gold/${id}`);
  return r;
}

export async function goldSaveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("content.manage", async (a) => {
    await saveGoldContent(a.user.id, str(fd, "id"), gold(fd));
    return { ok: true, message: "Gespeichert – neue Revision angelegt." };
  });
}

export async function goldTransitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("content.manage", async (a) => {
    const to = str(fd, "to");
    if (!GOLD_STATUSES.includes(to as GoldStatus)) throw new AppError("status", "Ungültiger Status.");
    const at = str(fd, "publishAt");
    await transitionGoldContent(a.user.id, str(fd, "id"), to as GoldStatus, at ? new Date(at) : null);
  });
}

export async function pageSaveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("content.manage", async (a) => {
    const nav = str(fd, "navOrder");
    await savePublicPage(a.user.id, str(fd, "id"), { title: str(fd, "title"), body: String(fd.get("body") ?? ""), navOrder: nav ? int(fd, "navOrder") : null });
  });
}

export async function discountRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("discounts.manage", async (a) => {
    await updateDiscountRule(a.user.id, str(fd, "id"), {
      amountCents: int(fd, "amountCents"), active: bool(fd, "active"), combinable: bool(fd, "combinable"), fundedBy: str(fd, "fundedBy"), perEventLimit: int(fd, "perEventLimit"),
    });
  });
}
