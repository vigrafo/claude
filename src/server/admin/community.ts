import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { randomToken } from "../crypto";
import { assertPerm, assertPlainText, requireReason } from "./guard";

const VIS = ["open", "closed", "invite"] as const;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export async function updateGroupSettings(actorUserId: string, groupId: string, input: { rules: string; visibility: string; description?: string }) {
  await assertPerm(actorUserId, "groups.manage");
  if (!VIS.includes(input.visibility as (typeof VIS)[number])) throw new AppError("visibility", "Ungültige Sichtbarkeit.");
  const rules = assertPlainText(input.rules.trim(), "Regeln");
  if (rules.length > 4000) throw new AppError("rules", "Regeln höchstens 4000 Zeichen.");
  const description = input.description != null ? assertPlainText(input.description.trim(), "Beschreibung") : undefined;
  if (description != null && (description.length < 20 || description.length > 4000)) throw new AppError("description", "Beschreibung 20–4000 Zeichen.");
  const g = await db.group.findUnique({ where: { id: groupId } });
  if (!g) throw notFound();
  await db.group.update({ where: { id: groupId }, data: { rules: rules || null, visibility: input.visibility, description } });
  await audit("group.settings_changed", { actorUserId, targetType: "group", targetId: groupId, meta: { visibility: input.visibility } });
}

export async function createOfficialGroup(actorUserId: string, input: { name: string; description: string; category: string; visibility: string; rules?: string }) {
  await assertPerm(actorUserId, "groups.manage");
  const name = assertPlainText(input.name.trim(), "Name");
  const description = assertPlainText(input.description.trim(), "Beschreibung");
  const category = assertPlainText(input.category.trim(), "Kategorie");
  if (name.length < 3 || name.length > 80) throw new AppError("name", "Name: 3–80 Zeichen.");
  if (description.length < 20 || description.length > 4000) throw new AppError("description", "Beschreibung: 20–4000 Zeichen.");
  if (category.length < 2) throw new AppError("category", "Kategorie angeben.");
  if (!VIS.includes(input.visibility as (typeof VIS)[number])) throw new AppError("visibility", "Ungültige Sichtbarkeit.");
  const slug = `${slugify(name) || "gruppe"}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
  const g = await db.group.create({
    data: {
      slug, name, description, category, visibility: input.visibility, rules: input.rules ? assertPlainText(input.rules.trim(), "Regeln") : null,
      official: true, status: "approved", createdById: actorUserId, decidedById: actorUserId,
      forumCategories: { create: { slug: `${slug}-forum`, name } },
    },
  });
  await audit("group.official_created", { actorUserId, targetType: "group", targetId: g.id, meta: { slug } });
  return g;
}

// ───────────── Foren ─────────────

export async function setThreadFlags(actorUserId: string, threadId: string, flags: { pinned?: boolean; locked?: boolean }) {
  await assertPerm(actorUserId, "forums.manage");
  const t = await db.thread.findUnique({ where: { id: threadId } });
  if (!t) throw notFound();
  await db.thread.update({ where: { id: threadId }, data: flags });
  const action = flags.pinned !== undefined ? (flags.pinned ? "pinned" : "unpinned") : flags.locked ? "locked" : "unlocked";
  await audit(`forum.thread_${action}`, { actorUserId, targetType: "thread", targetId: threadId });
}

export async function moveThread(actorUserId: string, threadId: string, categoryId: string, reasonRaw: string) {
  await assertPerm(actorUserId, "forums.manage");
  const reason = requireReason(reasonRaw, 3);
  const t = await db.thread.findUnique({ where: { id: threadId } });
  const c = await db.forumCategory.findUnique({ where: { id: categoryId } });
  if (!t || !c) throw notFound();
  if (t.categoryId === categoryId) throw new AppError("same", "Thema ist bereits in dieser Kategorie.");
  await db.thread.update({ where: { id: threadId }, data: { categoryId } });
  await audit("forum.thread_moved", { actorUserId, targetType: "thread", targetId: threadId, meta: { from: t.categoryId, to: categoryId, reason } });
}

export async function setPostHidden(actorUserId: string, postId: string, hidden: boolean, reasonRaw: string) {
  await assertPerm(actorUserId, "forums.manage");
  const reason = requireReason(reasonRaw, 3);
  const p = await db.post.findUnique({ where: { id: postId } });
  if (!p) throw notFound();
  await db.post.update({ where: { id: postId }, data: { hidden } });
  await audit(hidden ? "forum.post_hidden" : "forum.post_unhidden", { actorUserId, targetType: "post", targetId: postId, meta: { reason } });
}
