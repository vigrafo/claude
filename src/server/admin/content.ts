import { db, isUniqueViolation } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { assertPerm, assertPlainText } from "./guard";

/**
 * Gold-CMS: Statusworkflow draft → review → scheduled/published → archived/withdrawn.
 * Jede Speicherung erzeugt eine Revision (version+1). Veröffentlichung nur mit Rechtenachweis.
 */
export const GOLD_KINDS = ["article", "interview", "workshop", "video", "event_insight"] as const;
export const GOLD_STATUSES = ["draft", "review", "scheduled", "published", "archived", "withdrawn"] as const;
export type GoldStatus = (typeof GOLD_STATUSES)[number];

export const GOLD_TRANSITIONS: Record<GoldStatus, GoldStatus[]> = {
  draft: ["review", "archived"],
  review: ["draft", "scheduled", "published"],
  scheduled: ["draft", "published", "withdrawn"],
  published: ["withdrawn", "archived"],
  archived: ["draft"],
  withdrawn: ["draft", "archived"],
};

export interface GoldInput { slug: string; title: string; kind: string; category: string; summary: string; body: string; rightsProof?: string; mediaKey?: string }

function validate(i: GoldInput) {
  const slug = i.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw new AppError("slug", "Kennung: 3–80 Zeichen a–z, 0–9, -.");
  if (!GOLD_KINDS.includes(i.kind as (typeof GOLD_KINDS)[number])) throw new AppError("kind", "Ungültige Art.");
  const title = assertPlainText(i.title.trim(), "Titel");
  const summary = assertPlainText(i.summary.trim(), "Kurzfassung");
  const body = assertPlainText(i.body, "Inhalt");
  const category = assertPlainText(i.category.trim(), "Kategorie");
  if (title.length < 3 || title.length > 160) throw new AppError("title", "Titel: 3–160 Zeichen.");
  if (summary.length < 10 || summary.length > 400) throw new AppError("summary", "Kurzfassung: 10–400 Zeichen.");
  if (body.trim().length < 20 || body.length > 50_000) throw new AppError("body", "Inhalt: 20–50000 Zeichen.");
  if (category.length < 2 || category.length > 40) throw new AppError("category", "Kategorie: 2–40 Zeichen.");
  const rightsProof = i.rightsProof?.trim() ? assertPlainText(i.rightsProof.trim(), "Rechtenachweis").slice(0, 500) : null;
  return { slug, title, summary, body, category, kind: i.kind, rightsProof, mediaKey: i.mediaKey?.trim() || null };
}

export async function createGoldContent(actorUserId: string, input: GoldInput) {
  await assertPerm(actorUserId, "content.manage");
  const v = validate(input);
  try {
    const c = await db.goldContent.create({
      data: { ...v, status: "draft", version: 1, createdById: actorUserId, revisions: { create: { version: 1, title: v.title, body: v.body, editedBy: actorUserId } } },
    });
    await audit("gold.created", { actorUserId, targetType: "gold_content", targetId: c.id, meta: { slug: v.slug } });
    return c;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("duplicate", "Diese Kennung ist bereits vergeben.");
    throw e;
  }
}

export async function saveGoldContent(actorUserId: string, id: string, input: GoldInput) {
  await assertPerm(actorUserId, "content.manage");
  const v = validate(input);
  const c = await db.goldContent.findUnique({ where: { id } });
  if (!c) throw notFound();
  if (c.status === "published" && !v.rightsProof) throw new AppError("rights", "Veröffentlichte Inhalte brauchen einen Rechtenachweis.");
  const version = c.version + 1;
  try {
    await db.$transaction([
      db.goldContent.update({ where: { id }, data: { ...v, version } }),
      db.goldContentRevision.create({ data: { contentId: id, version, title: v.title, body: v.body, editedBy: actorUserId } }),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("duplicate", "Diese Kennung ist bereits vergeben.");
    throw e;
  }
  await audit("gold.saved", { actorUserId, targetType: "gold_content", targetId: id, meta: { version } });
}

export async function transitionGoldContent(actorUserId: string, id: string, to: GoldStatus, publishAt?: Date | null) {
  await assertPerm(actorUserId, "content.manage");
  const c = await db.goldContent.findUnique({ where: { id } });
  if (!c) throw notFound();
  const from = c.status as GoldStatus;
  if (!GOLD_TRANSITIONS[from]?.includes(to)) throw new AppError("transition", `Statuswechsel ${from} → ${to} ist nicht erlaubt.`);
  if ((to === "published" || to === "scheduled") && !c.rightsProof?.trim()) {
    throw new AppError("rights", "Veröffentlichung nur mit hinterlegtem Rechtenachweis (Bild-/Text-/Personenrechte).");
  }
  let at: Date | null = c.publishAt;
  if (to === "scheduled") {
    if (!publishAt || Number.isNaN(publishAt.getTime()) || publishAt.getTime() <= Date.now()) throw new AppError("publish_at", "Für die Planung ein Datum in der Zukunft angeben.");
    at = publishAt;
  }
  if (to === "published") at = new Date();
  await db.goldContent.update({ where: { id }, data: { status: to, publishAt: at } });
  await audit(`gold.${to}`, { actorUserId, targetType: "gold_content", targetId: id, meta: { from, publishAt: at?.toISOString() ?? null } });
}

// ───────────── Öffentliche Seiten (nur Klartext) ─────────────

export async function savePublicPage(actorUserId: string, id: string, input: { title: string; body: string; navOrder?: number | null }) {
  await assertPerm(actorUserId, "content.manage");
  const title = assertPlainText(input.title.trim(), "Titel");
  const body = assertPlainText(input.body, "Text");
  if (title.length < 2 || title.length > 120) throw new AppError("title", "Titel: 2–120 Zeichen.");
  if (body.trim().length < 2 || body.length > 100_000) throw new AppError("body", "Text: 2–100000 Zeichen.");
  if (input.navOrder != null && (!Number.isInteger(input.navOrder) || input.navOrder < 0 || input.navOrder > 99)) throw new AppError("nav", "Reihenfolge 0–99.");
  const p = await db.publicPage.findUnique({ where: { id } });
  if (!p) throw notFound();
  await db.publicPage.update({ where: { id }, data: { title, body, navOrder: input.navOrder ?? null } });
  await audit("page.saved", { actorUserId, targetType: "public_page", targetId: id, meta: { slug: p.slug } });
}

// ───────────── Gold-Rabatte ─────────────

export async function updateDiscountRule(actorUserId: string, id: string, input: { amountCents: number; active: boolean; combinable: boolean; fundedBy: string; perEventLimit: number }) {
  await assertPerm(actorUserId, "discounts.manage");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0 || input.amountCents > 10_000) throw new AppError("amount", "Betrag in Cent: 0–10000.");
  if (!Number.isInteger(input.perEventLimit) || input.perEventLimit < 1 || input.perEventLimit > 10) throw new AppError("limit", "Limit je Event: 1–10.");
  if (!["eropub", "organizer", "shared"].includes(input.fundedBy)) throw new AppError("funded", "Finanzierung: eropub, organizer oder shared.");
  const r = await db.discountRule.findUnique({ where: { id } });
  if (!r) throw notFound();
  await db.discountRule.update({ where: { id }, data: input });
  await audit("discount.rule_updated", { actorUserId, targetType: "discount_rule", targetId: id, meta: { key: r.key, ...input } });
}
