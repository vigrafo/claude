import { db, isUniqueViolation, type Tx } from "./db";
import { AppError, forbidden } from "./errors";
import { can } from "@/domain/access";
import { answersHash, scoreRound, type AnswerMap, type GameRules, type GameVariant } from "@/domain/games";
import { isBlockedEitherWay, personState, profileState } from "./state";
import { orderedPair } from "@/domain/messaging";
import { enqueue } from "./outbox";

interface QuestionSnap { key: string; text: string; options: { key: string; label: string; neutral: boolean }[] }

async function requireCoupleMember(tx: Tx, userId: string, profileId: string) {
  const prof = await profileState(profileId, tx);
  const actor = await personState(userId, tx);
  if (!prof || !actor || !prof.members.some((m) => m.userId === userId)) throw forbidden();
  if (prof.type !== "couple") throw new AppError("couples_only", "Kennenlernspiele sind für Paarprofile.");
  const c = can("games", actor, prof);
  if (!c.allowed) throw forbidden(c.reason);
  return prof;
}

export async function activeRules(tx: Tx = db) {
  const r = await tx.gameRuleVersion.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
  if (!r) throw new AppError("no_rules", "Keine aktive Spielregel.", 500);
  return r;
}

/** Einladung: Snapshot von Regeln + Fragen. Spätere Adminänderungen wirken nicht auf diese Runde. */
export async function inviteGame(userId: string, fromProfileId: string, toProfileId: string, variant: GameVariant) {
  return db.$transaction(async (tx) => {
    await requireCoupleMember(tx, userId, fromProfileId);
    const target = await profileState(toProfileId, tx);
    if (!target || target.type !== "couple" || target.status !== "active") throw new AppError("invalid_target", "Profil nicht verfügbar.");
    if (!target.members.every((m) => m.identityStatus === "verified") || target.members.length !== 2) {
      throw new AppError("invalid_target", "Das andere Paar ist nicht vollständig verifiziert.");
    }
    if (await isBlockedEitherWay(fromProfileId, toProfileId, tx)) throw forbidden("Einladung nicht möglich.");
    const rules = await activeRules(tx);
    const since = new Date(Date.now() - 86400_000);
    const recent = await tx.gameSession.count({ where: { invitedById: fromProfileId, createdAt: { gte: since } } });
    if (recent >= rules.inviteLimitPerDay) throw new AppError("rate_limited", "Tageslimit für Einladungen erreicht.", 429);
    const open = await tx.gameSession.findFirst({
      where: {
        status: { in: ["invited", "accepted", "answering"] },
        AND: [{ participants: { some: { profileId: fromProfileId } } }, { participants: { some: { profileId: toProfileId } } }],
      },
    });
    if (open) throw new AppError("exists", "Es gibt bereits eine offene Runde mit diesem Paar.");

    const qs = await tx.gameQuestionVersion.findMany({ where: { variant, status: "approved", locale: "de" }, include: { options: { orderBy: { sort: "asc" } } } });
    // je questionKey nur die neueste Version
    const latest = new Map<string, (typeof qs)[number]>();
    for (const q of qs) if (!latest.has(q.questionKey) || latest.get(q.questionKey)!.version < q.version) latest.set(q.questionKey, q);
    const pool = [...latest.values()].sort(() => Math.random() - 0.5);
    if (pool.length < rules.minAnswered) throw new AppError("not_enough_questions", "Zu wenige freigegebene Fragen für diese Variante.", 500);
    const take = pool.slice(0, rules.roundSize);
    const reserve = pool.slice(rules.roundSize, rules.roundSize + 5);
    const snap = (q: (typeof qs)[number]): QuestionSnap => ({
      key: q.questionKey, text: q.text, options: q.options.map((o) => ({ key: o.key, label: o.label, neutral: o.neutral })),
    });
    const session = await tx.gameSession.create({
      data: {
        variant, invitedById: fromProfileId, status: "invited",
        ruleSnapshot: { version: rules.version, roundSize: rules.roundSize, minAnswered: rules.minAnswered, thresholdBp: rules.thresholdBp },
        questionSnapshot: { questions: take.map(snap), reserve: reserve.map(snap) } as object,
        expiresAt: new Date(Date.now() + rules.expiresHours * 3600_000),
        participants: { create: [{ profileId: fromProfileId, status: "accepted" }, { profileId: toProfileId, status: "invited" }] },
      },
      include: { participants: true },
    });
    const me = session.participants.find((p) => p.profileId === fromProfileId)!;
    await tx.gamePersonConsent.create({ data: { participantId: me.id, userId, kind: "join" } });
    for (const m of target.members) {
      await enqueue(tx, "notify.user", { userId: m.userId, kind: "game", title: "Neue Einladung zu einem Kennenlernspiel", link: `/spiele/${session.id}` });
    }
    return session;
  });
}

/** Jede Person bestätigt die Teilnahme separat; erst beide → Paar „accepted“. Erst beide Paare → „answering“. */
export async function consentJoin(userId: string, sessionId: string, profileId: string, accept: boolean) {
  return db.$transaction(async (tx) => {
    const prof = await requireCoupleMember(tx, userId, profileId);
    const part = await tx.gameParticipant.findUnique({ where: { sessionId_profileId: { sessionId, profileId } }, include: { session: true } });
    if (!part) throw forbidden();
    if (!["invited", "accepted"].includes(part.session.status)) throw new AppError("closed", "Diese Runde ist nicht mehr offen.");
    if (!accept) {
      await tx.gameParticipant.update({ where: { id: part.id }, data: { status: "declined" } });
      await tx.gameSession.update({ where: { id: sessionId }, data: { status: "declined" } });
      return "declined";
    }
    try {
      await tx.gamePersonConsent.create({ data: { participantId: part.id, userId, kind: "join" } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    const joins = await tx.gamePersonConsent.count({ where: { participantId: part.id, kind: "join" } });
    if (joins >= prof.members.length) {
      await tx.gameParticipant.update({ where: { id: part.id }, data: { status: "answering" } });
    }
    const all = await tx.gameParticipant.findMany({ where: { sessionId } });
    const allIn = await Promise.all(all.map(async (p) => (await tx.gamePersonConsent.count({ where: { participantId: p.id, kind: "join" } })) >= 2));
    if (allIn.every(Boolean)) {
      await tx.gameParticipant.updateMany({ where: { sessionId }, data: { status: "answering" } });
      await tx.gameSession.update({ where: { id: sessionId }, data: { status: "answering" } });
      return "answering";
    }
    return "waiting";
  });
}

function snapshotOf(s: { questionSnapshot: unknown }) {
  return s.questionSnapshot as { questions: QuestionSnap[]; reserve: QuestionSnap[] };
}

/** Antwort setzen/ändern. Jede Änderung setzt die Antwort-Bestätigungen des Paars zurück. */
export async function setAnswer(userId: string, sessionId: string, profileId: string, questionKey: string, optionKey: string | null) {
  return db.$transaction(async (tx) => {
    await requireCoupleMember(tx, userId, profileId);
    const part = await tx.gameParticipant.findUnique({ where: { sessionId_profileId: { sessionId, profileId } }, include: { session: true } });
    if (!part || part.session.status !== "answering") throw new AppError("closed", "Antworten ist gerade nicht möglich.");
    if (part.status === "submitted") throw new AppError("locked", "Eure Antworten sind bereits abgegeben und gesperrt.");
    const snap = snapshotOf(part.session);
    const q = [...snap.questions, ...snap.reserve].find((x) => x.key === questionKey);
    if (!q) throw new AppError("invalid_question", "Frage gehört nicht zu dieser Runde.");
    if (optionKey !== null && !q.options.some((o) => o.key === optionKey)) throw new AppError("invalid_option", "Ungültige Antwort.");
    await tx.gameAnswer.upsert({
      where: { sessionId_participantId_questionKey: { sessionId, participantId: part.id, questionKey } },
      create: { sessionId, participantId: part.id, questionKey, optionKey, updatedById: userId },
      update: { optionKey, updatedById: userId },
    });
    await tx.gamePersonConsent.deleteMany({ where: { participantId: part.id, kind: "answers" } });
  });
}

async function currentAnswers(tx: Tx, sessionId: string, participantId: string, keys: string[]): Promise<AnswerMap> {
  const rows = await tx.gameAnswer.findMany({ where: { sessionId, participantId } });
  const m: AnswerMap = {};
  for (const k of keys) m[k] = rows.find((r) => r.questionKey === k)?.optionKey ?? null;
  return m;
}

/**
 * Bestätigung der gemeinsamen Antworten durch eine Person (bezogen auf genau diese Antwortversion).
 * Wenn beide Personen dieselbe Version bestätigt haben → Abgabe wird gesperrt.
 * Wenn beide Paare abgegeben haben → serverseitige, idempotente Auswertung.
 */
export async function confirmAnswers(userId: string, sessionId: string, profileId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GameSession" WHERE id = ${sessionId} FOR UPDATE`;
    await requireCoupleMember(tx, userId, profileId);
    const part = await tx.gameParticipant.findUnique({ where: { sessionId_profileId: { sessionId, profileId } }, include: { session: true } });
    if (!part || part.session.status !== "answering") throw new AppError("closed", "Abgabe nicht möglich.");
    if (part.status === "submitted") return { state: "submitted" as const };
    const snap = snapshotOf(part.session);
    const keys = await roundKeys(tx, sessionId, part.id, snap);
    const answers = await currentAnswers(tx, sessionId, part.id, keys);
    const hash = answersHash(answers);
    await tx.gamePersonConsent.upsert({
      where: { participantId_userId_kind: { participantId: part.id, userId, kind: "answers" } },
      create: { participantId: part.id, userId, kind: "answers", answersHash: hash },
      update: { answersHash: hash },
    });
    const confirms = await tx.gamePersonConsent.findMany({ where: { participantId: part.id, kind: "answers" } });
    if (confirms.length < 2 || !confirms.every((c) => c.answersHash === hash)) return { state: "waiting_partner" as const };
    await tx.gameSubmission.create({ data: { sessionId, participantId: part.id, answersHash: hash, lockedAnswers: answers as object } });
    await tx.gameParticipant.update({ where: { id: part.id }, data: { status: "submitted" } });
    const subs = await tx.gameSubmission.count({ where: { sessionId } });
    if (subs === 2) await evaluate(tx, sessionId);
    return { state: "submitted" as const };
  });
}

/** Übersprungene Fragen werden nach Möglichkeit durch Reservefragen ersetzt (für beide Paare gleich). */
async function roundKeys(tx: Tx, sessionId: string, _participantId: string, snap: { questions: QuestionSnap[]; reserve: QuestionSnap[] }) {
  const keys = snap.questions.map((q) => q.key);
  const answered = await tx.gameAnswer.findMany({ where: { sessionId, questionKey: { in: snap.reserve.map((r) => r.key) } } });
  for (const r of snap.reserve) if (answered.some((a) => a.questionKey === r.key)) keys.push(r.key);
  return keys;
}

async function evaluate(tx: Tx, sessionId: string) {
  const existing = await tx.gameMatch.findUnique({ where: { sessionId } });
  if (existing) return existing;
  const session = await tx.gameSession.findUniqueOrThrow({ where: { id: sessionId }, include: { submissions: true } });
  const rules = session.ruleSnapshot as unknown as GameRules;
  const [a, b] = session.submissions;
  const snap = snapshotOf(session);
  const neutral = new Set<string>();
  for (const q of [...snap.questions, ...snap.reserve]) for (const o of q.options) if (o.neutral) neutral.add(o.key);
  const r = scoreRound(a.lockedAnswers as AnswerMap, b.lockedAnswers as AnswerMap, rules, neutral);
  const match = await tx.gameMatch.create({
    data: { sessionId, isMatch: r.status === "match", answeredBoth: r.answeredBoth, hits: r.hits, sharedKeys: r.sharedKeys },
  });
  await tx.gameSession.update({ where: { id: sessionId }, data: { status: "completed", incomplete: r.status === "incomplete", completedAt: new Date() } });
  return match;
}

/** Ein Fragen-Match ist nur ein Vorschlag: Erst wenn alle vier Personen zustimmen, entsteht eine Verbindung. */
export async function consentContact(userId: string, sessionId: string, profileId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GameSession" WHERE id = ${sessionId} FOR UPDATE`;
    await requireCoupleMember(tx, userId, profileId);
    const s = await tx.gameSession.findUniqueOrThrow({ where: { id: sessionId }, include: { match: true, participants: true } });
    if (!s.match?.isMatch) throw new AppError("no_match", "Kein Fragen-Match in dieser Runde.");
    const part = s.participants.find((p) => p.profileId === profileId);
    if (!part) throw forbidden();
    const [x, y] = orderedPair(s.participants[0].profileId, s.participants[1].profileId);
    if (await isBlockedEitherWay(x, y, tx)) throw forbidden();
    try {
      await tx.gamePersonConsent.create({ data: { participantId: part.id, userId, kind: "contact" } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    const total = await tx.gamePersonConsent.count({ where: { participantId: { in: s.participants.map((p) => p.id) }, kind: "contact" } });
    if (total < 4) return { connected: false, consents: total };
    const conn = await tx.connection.upsert({ where: { aId_bId: { aId: x, bId: y } }, create: { aId: x, bId: y }, update: { endedAt: null } });
    await tx.gameMatch.update({ where: { sessionId }, data: { connectionId: conn.id } });
    return { connected: true, consents: 4 };
  });
}

/** Sichtbare Ergebnisdaten: eigene Antworten nur fürs eigene Paar; andere Paare sehen nur Ergebnis & Gemeinsamkeiten. */
export async function viewSession(userId: string, sessionId: string, profileId: string) {
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw forbidden();
  const s = await db.gameSession.findUnique({ where: { id: sessionId }, include: { participants: true, match: true } });
  if (!s) throw forbidden();
  const mine = s.participants.find((p) => p.profileId === profileId);
  if (!mine) throw forbidden();
  const myAnswers = await db.gameAnswer.findMany({ where: { sessionId, participantId: mine.id } });
  const confirms = await db.gamePersonConsent.findMany({ where: { participantId: mine.id } });
  const snap = snapshotOf(s);
  return {
    id: s.id, variant: s.variant, status: s.status, incomplete: s.incomplete, expiresAt: s.expiresAt,
    rules: s.ruleSnapshot, questions: snap.questions, reserve: snap.reserve,
    myStatus: mine.status,
    myAnswers: Object.fromEntries(myAnswers.map((a) => [a.questionKey, a.optionKey])),
    myConfirmations: confirms.map((c) => ({ userId: c.userId, kind: c.kind })),
    otherProfileId: s.participants.find((p) => p.profileId !== profileId)?.profileId,
    otherStatus: s.participants.find((p) => p.profileId !== profileId)?.status, // Status, keine Antworten
    result: s.match ? { isMatch: s.match.isMatch, hits: s.match.hits, answeredBoth: s.match.answeredBoth, sharedKeys: s.match.sharedKeys } : null,
  };
}

/** Blockierung / Verifizierungsentzug / Paarauflösung stoppt offene Runden. */
export async function cancelOpenGamesFor(tx: Tx, profileId: string, reason: string) {
  const open = await tx.gameSession.findMany({
    where: { status: { in: ["invited", "accepted", "answering"] }, participants: { some: { profileId } } },
  });
  for (const s of open) await tx.gameSession.update({ where: { id: s.id }, data: { status: "cancelled" } });
  return open.length + (reason ? 0 : 0);
}
