import { db, isUniqueViolation } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import type { PermissionKey } from "../rbac";
import { setSetting, type SettingKey } from "../settings";
import { assertPerm, assertPlainText, requireReason } from "./guard";

/** Einstellung mit bereichsspezifischem Recht ändern (setSetting validiert per zod, versioniert, auditiert). */
export async function adminSetSetting(actorUserId: string, perm: PermissionKey, key: SettingKey, value: unknown, reasonRaw: string) {
  await assertPerm(actorUserId, perm);
  const reason = requireReason(reasonRaw, 3);
  return setSetting(key, value, actorUserId, reason);
}

export async function createInterest(actorUserId: string, input: { slug: string; label: string; category: string }) {
  await assertPerm(actorUserId, "matching.manage");
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new AppError("slug", "Kennung: 2–40 Zeichen a–z, 0–9, -.");
  const label = assertPlainText(input.label.trim(), "Bezeichnung");
  const category = assertPlainText(input.category.trim(), "Kategorie");
  if (label.length < 2 || label.length > 60 || category.length < 2 || category.length > 40) throw new AppError("invalid", "Bezeichnung (2–60) und Kategorie (2–40) angeben.");
  try {
    const i = await db.interest.create({ data: { slug, label, category } });
    await audit("interest.created", { actorUserId, targetType: "interest", targetId: i.id, meta: { slug } });
    return i;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("duplicate", "Diese Kennung existiert bereits.");
    throw e;
  }
}

export async function updateInterest(actorUserId: string, id: string, input: { label: string; category: string }) {
  await assertPerm(actorUserId, "matching.manage");
  const label = assertPlainText(input.label.trim(), "Bezeichnung");
  const category = assertPlainText(input.category.trim(), "Kategorie");
  if (label.length < 2 || label.length > 60 || category.length < 2 || category.length > 40) throw new AppError("invalid", "Bezeichnung (2–60) und Kategorie (2–40) angeben.");
  const i = await db.interest.findUnique({ where: { id } });
  if (!i) throw notFound();
  await db.interest.update({ where: { id }, data: { label, category } });
  await audit("interest.updated", { actorUserId, targetType: "interest", targetId: id, meta: { slug: i.slug } });
}

export async function setInterestActive(actorUserId: string, id: string, active: boolean) {
  await assertPerm(actorUserId, "matching.manage");
  const i = await db.interest.findUnique({ where: { id } });
  if (!i) throw notFound();
  await db.interest.update({ where: { id }, data: { active } });
  await audit(active ? "interest.activated" : "interest.deactivated", { actorUserId, targetType: "interest", targetId: id, meta: { slug: i.slug } });
}
