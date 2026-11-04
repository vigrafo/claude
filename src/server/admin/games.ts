import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { randomToken } from "../crypto";
import { GAME_VARIANTS, scoreRound, type AnswerMap, type GameVariant } from "@/domain/games";
import { assertPerm, assertPlainText } from "./guard";

/**
 * Fragenkatalog: freigegebene Versionen werden NIE verändert. Bearbeiten erzeugt eine neue Version
 * (gleicher questionKey, version+1, Status draft). Laufende Runden nutzen ihren Snapshot.
 */
export const NEUTRAL_OPTION = { key: "not_my_topic", label: "Nicht mein Thema" } as const;

function parseOptions(lines: string[]): string[] {
  const opts = lines.map((l) => l.trim()).filter(Boolean).filter((l) => l.toLowerCase() !== NEUTRAL_OPTION.label.toLowerCase());
  if (opts.length < 2 || opts.length > 6) throw new AppError("options", "2 bis 6 Antwortoptionen angeben (eine pro Zeile).");
  for (const o of opts) {
    assertPlainText(o, "Option");
    if (o.length > 80) throw new AppError("options", "Optionen höchstens 80 Zeichen.");
  }
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) throw new AppError("options", "Optionen müssen unterschiedlich sein.");
  return opts;
}

function validateQuestion(input: { variant: string; category: string; text: string }) {
  if (!(input.variant in GAME_VARIANTS)) throw new AppError("variant", "Unbekannte Spielvariante.");
  const text = assertPlainText(input.text.trim(), "Frage");
  const category = assertPlainText(input.category.trim(), "Kategorie");
  if (text.length < 5 || text.length > 200) throw new AppError("text", "Frage: 5–200 Zeichen.");
  if (category.length < 2 || category.length > 40) throw new AppError("category", "Kategorie: 2–40 Zeichen.");
  return { variant: input.variant as GameVariant, text, category };
}

function optionCreates(opts: string[]) {
  return [
    ...opts.map((label, i) => ({ key: `o${i + 1}`, label, sort: i })),
    { key: NEUTRAL_OPTION.key, label: NEUTRAL_OPTION.label, sort: 99, neutral: true },
  ];
}

export async function createQuestion(actorUserId: string, input: { variant: string; category: string; text: string; options: string[] }) {
  await assertPerm(actorUserId, "games.manage");
  const v = validateQuestion(input);
  const opts = parseOptions(input.options);
  const questionKey = `adm_${randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").toLowerCase()}`;
  const q = await db.gameQuestionVersion.create({
    data: { questionKey, version: 1, variant: v.variant, category: v.category, text: v.text, status: "draft", options: { create: optionCreates(opts) } },
  });
  await audit("game.question_created", { actorUserId, targetType: "game_question", targetId: q.id, meta: { questionKey, variant: v.variant } });
  return q;
}

/** Bearbeiten = neue Version (draft). Die Quellversion bleibt unverändert. */
export async function editQuestion(actorUserId: string, questionId: string, input: { category: string; text: string; options: string[] }) {
  await assertPerm(actorUserId, "games.manage");
  const src = await db.gameQuestionVersion.findUnique({ where: { id: questionId } });
  if (!src) throw notFound();
  const v = validateQuestion({ variant: src.variant, category: input.category, text: input.text });
  const opts = parseOptions(input.options);
  const last = await db.gameQuestionVersion.findFirst({ where: { questionKey: src.questionKey }, orderBy: { version: "desc" } });
  const q = await db.gameQuestionVersion.create({
    data: {
      questionKey: src.questionKey, version: (last?.version ?? src.version) + 1, variant: src.variant, category: v.category, text: v.text,
      locale: src.locale, status: "draft", options: { create: optionCreates(opts) },
    },
  });
  await audit("game.question_versioned", { actorUserId, targetType: "game_question", targetId: q.id, meta: { questionKey: q.questionKey, version: q.version, from: src.version } });
  return q;
}

/** Freigabe eines Entwurfs. Ältere freigegebene Versionen desselben Schlüssels werden archiviert (nicht verändert). */
export async function approveQuestion(actorUserId: string, questionId: string) {
  await assertPerm(actorUserId, "games.manage");
  const q = await db.gameQuestionVersion.findUnique({ where: { id: questionId } });
  if (!q) throw notFound();
  if (q.status !== "draft") throw new AppError("state", "Nur Entwürfe können freigegeben werden.");
  await db.$transaction([
    db.gameQuestionVersion.updateMany({ where: { questionKey: q.questionKey, status: "approved", version: { lt: q.version } }, data: { status: "archived" } }),
    db.gameQuestionVersion.update({ where: { id: q.id }, data: { status: "approved" } }),
  ]);
  await audit("game.question_approved", { actorUserId, targetType: "game_question", targetId: q.id, meta: { questionKey: q.questionKey, version: q.version } });
}

export async function archiveQuestion(actorUserId: string, questionId: string) {
  await assertPerm(actorUserId, "games.manage");
  const q = await db.gameQuestionVersion.findUnique({ where: { id: questionId } });
  if (!q) throw notFound();
  if (q.status === "archived") throw new AppError("state", "Bereits archiviert.");
  await db.gameQuestionVersion.update({ where: { id: q.id }, data: { status: "archived" } });
  await audit("game.question_archived", { actorUserId, targetType: "game_question", targetId: q.id, meta: { questionKey: q.questionKey, version: q.version } });
}

export interface RuleInput { roundSize: number; minAnswered: number; thresholdBp: number; inviteLimitPerDay: number; expiresHours: number }

export function validateRules(r: RuleInput) {
  const int = (n: number, lo: number, hi: number, label: string) => {
    if (!Number.isInteger(n) || n < lo || n > hi) throw new AppError("rules", `${label}: ${lo}–${hi}.`);
  };
  int(r.roundSize, 4, 30, "Fragen je Runde");
  int(r.minAnswered, 1, r.roundSize, "Mindestens beantwortet (≤ Fragen je Runde)");
  int(r.thresholdBp, 5000, 10000, "Schwelle in Basispunkten");
  int(r.inviteLimitPerDay, 1, 50, "Einladungen pro Tag");
  int(r.expiresHours, 1, 720, "Ablauf in Stunden");
}

export async function createRuleVersion(actorUserId: string, r: RuleInput) {
  await assertPerm(actorUserId, "games.manage");
  validateRules(r);
  const last = await db.gameRuleVersion.findFirst({ orderBy: { version: "desc" } });
  const row = await db.gameRuleVersion.create({ data: { ...r, version: (last?.version ?? 0) + 1, active: false, createdById: actorUserId } });
  await audit("game.rules_created", { actorUserId, targetType: "game_rules", targetId: row.id, meta: { version: row.version, ...r } });
  return row;
}

/** Genau eine aktive Regelversion. Laufende Runden behalten ihren Regel-Snapshot. */
export async function activateRuleVersion(actorUserId: string, id: string) {
  await assertPerm(actorUserId, "games.manage");
  const r = await db.gameRuleVersion.findUnique({ where: { id } });
  if (!r) throw notFound();
  await db.$transaction([
    db.gameRuleVersion.updateMany({ where: { active: true }, data: { active: false } }),
    db.gameRuleVersion.update({ where: { id }, data: { active: true } }),
  ]);
  await audit("game.rules_activated", { actorUserId, targetType: "game_rules", targetId: id, meta: { version: r.version } });
}

/** Testauswertung mit künstlichen Antworten – reine Funktion, keine DB-Schreibzugriffe. */
export function previewEvaluation(rules: { roundSize: number; minAnswered: number; thresholdBp: number }, aRaw: string, bRaw: string) {
  const parse = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  const a = parse(aRaw);
  const b = parse(bRaw);
  const n = Math.max(a.length, b.length);
  const A: AnswerMap = {};
  const B: AnswerMap = {};
  for (let i = 0; i < n; i++) {
    const k = `q${i + 1}`;
    A[k] = a[i] && a[i] !== "-" ? a[i] : null;
    B[k] = b[i] && b[i] !== "-" ? b[i] : null;
  }
  return scoreRound(A, B, rules, new Set([NEUTRAL_OPTION.key, "n"]));
}

/** Aggregierte Statistik – kein Zugriff auf einzelne Antworten. */
export async function gameStats() {
  const byStatus = await db.gameSession.groupBy({ by: ["status"], _count: { _all: true } });
  const matches = await db.gameMatch.groupBy({ by: ["isMatch"], _count: { _all: true } });
  const total = matches.reduce((s, m) => s + m._count._all, 0);
  const hit = matches.find((m) => m.isMatch)?._count._all ?? 0;
  return {
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    evaluated: total,
    matchRate: total ? hit / total : null,
  };
}
