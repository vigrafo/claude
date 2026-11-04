import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { confirmAnswers, consentContact, consentJoin, inviteGame, setAnswer, viewSession } from "@/server/games";
import { blockProfile } from "@/server/safety";
import { areConnected } from "@/server/state";
import { ledgerBalance } from "@/server/tokens";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

async function twoCouples(verifiedAll = true) {
  const a1 = await makeUser(); const a2 = await makeUser();
  const b1 = await makeUser(); const b2 = await makeUser({ verified: verifiedAll });
  const A = await makeProfile("couple", [a1, a2], 3);
  const B = await makeProfile("couple", [b1, b2], 3);
  return { a1, a2, b1, b2, A, B };
}

async function startRound() {
  const c = await twoCouples();
  const s = await inviteGame(c.a1.id, c.A.id, c.B.id, "either_or");
  await consentJoin(c.a2.id, s.id, c.A.id, true);
  await consentJoin(c.b1.id, s.id, c.B.id, true);
  const st = await consentJoin(c.b2.id, s.id, c.B.id, true);
  expect(st).toBe("answering");
  const view = await viewSession(c.a1.id, s.id, c.A.id);
  return { ...c, sessionId: s.id, questions: view.questions as { key: string; options: { key: string; neutral: boolean }[] }[] };
}

async function answerAll(userId: string, sessionId: string, profileId: string, qs: { key: string }[], pick: (i: number) => string | null) {
  for (const [i, q] of qs.entries()) await setAnswer(userId, sessionId, profileId, q.key, pick(i));
}

describe("Kennenlernspiele", () => {
  it("Paar mit nicht verifizierter Person kann nicht eingeladen werden / spielen", async () => {
    const c = await twoCouples(false);
    await expect(inviteGame(c.a1.id, c.A.id, c.B.id, "either_or")).rejects.toMatchObject({ code: "invalid_target" });
    await expect(inviteGame(c.b1.id, c.B.id, c.A.id, "either_or")).rejects.toMatchObject({ status: 403 });
  });

  it("8 von 10 Treffern → Match; Antworten des anderen Paars vor Abgabe verborgen; Bestätigung beider Personen nötig", async () => {
    const r = await startRound();
    await answerAll(r.a1.id, r.sessionId, r.A.id, r.questions, () => "o1");
    await answerAll(r.b1.id, r.sessionId, r.B.id, r.questions, (i) => (i < 8 ? "o1" : "o2"));
    // A bestätigt nur durch eine Person → noch nicht abgegeben
    expect((await confirmAnswers(r.a1.id, r.sessionId, r.A.id)).state).toBe("waiting_partner");
    // Änderung durch Partner setzt Bestätigung zurück
    await setAnswer(r.a2.id, r.sessionId, r.A.id, r.questions[0].key, "o1");
    expect((await confirmAnswers(r.a2.id, r.sessionId, r.A.id)).state).toBe("waiting_partner");
    expect((await confirmAnswers(r.a1.id, r.sessionId, r.A.id)).state).toBe("submitted");
    // Gesperrt nach Abgabe
    await expect(setAnswer(r.a1.id, r.sessionId, r.A.id, r.questions[0].key, "o2")).rejects.toMatchObject({ code: "locked" });
    // B sieht A's Antworten nicht
    const viewB = await viewSession(r.b1.id, r.sessionId, r.B.id);
    expect(viewB.result).toBeNull();
    expect(JSON.stringify(viewB)).not.toContain(r.A.id + '":');
    await confirmAnswers(r.b1.id, r.sessionId, r.B.id);
    await confirmAnswers(r.b2.id, r.sessionId, r.B.id);
    const done = await viewSession(r.b1.id, r.sessionId, r.B.id);
    expect(done.result).toMatchObject({ isMatch: true, hits: 8, answeredBoth: 10 });
    // Wiederholte Auswertung → genau ein Ergebnis
    expect(await db.gameMatch.count({ where: { sessionId: r.sessionId } })).toBe(1);
    // Match allein erzeugt keinen Kontakt
    expect(await areConnected(r.A.id, r.B.id)).toBe(false);
    for (const [u, p] of [[r.a1, r.A], [r.a2, r.A], [r.b1, r.B]] as const) await consentContact(u.id, r.sessionId, p.id);
    expect(await areConnected(r.A.id, r.B.id)).toBe(false);
    expect((await consentContact(r.b2.id, r.sessionId, r.B.id)).connected).toBe(true);
    expect(await areConnected(r.A.id, r.B.id)).toBe(true);
    // Spiele kosten keine Tokens
    expect(await ledgerBalance(r.A.id)).toBe(3);
  });

  it("7 von 10 Treffern → kein Match; Überspringen < 8 → unvollständig", async () => {
    const r = await startRound();
    await answerAll(r.a1.id, r.sessionId, r.A.id, r.questions, () => "o1");
    await answerAll(r.b1.id, r.sessionId, r.B.id, r.questions, (i) => (i < 7 ? "o1" : "o2"));
    for (const [u, p] of [[r.a1, r.A], [r.a2, r.A], [r.b1, r.B], [r.b2, r.B]] as const) await confirmAnswers(u.id, r.sessionId, p.id);
    expect((await viewSession(r.a1.id, r.sessionId, r.A.id)).result).toMatchObject({ isMatch: false, hits: 7 });

    const s = await startRound();
    await answerAll(s.a1.id, s.sessionId, s.A.id, s.questions, (i) => (i < 7 ? "o1" : null));
    await answerAll(s.b1.id, s.sessionId, s.B.id, s.questions, () => "o1");
    for (const [u, p] of [[s.a1, s.A], [s.a2, s.A], [s.b1, s.B], [s.b2, s.B]] as const) await confirmAnswers(u.id, s.sessionId, p.id);
    const v = await viewSession(s.a1.id, s.sessionId, s.A.id);
    expect(v.incomplete).toBe(true);
    expect(v.result?.isMatch).toBe(false);
  });

  it("neue Adminregeln verändern laufende Runden nicht (Snapshot)", async () => {
    const r = await startRound();
    await db.gameRuleVersion.updateMany({ data: { active: false } });
    await db.gameRuleVersion.create({ data: { version: 99, roundSize: 10, minAnswered: 10, thresholdBp: 10000, active: true } });
    await answerAll(r.a1.id, r.sessionId, r.A.id, r.questions, () => "o1");
    await answerAll(r.b1.id, r.sessionId, r.B.id, r.questions, (i) => (i < 8 ? "o1" : "o2"));
    for (const [u, p] of [[r.a1, r.A], [r.a2, r.A], [r.b1, r.B], [r.b2, r.B]] as const) await confirmAnswers(u.id, r.sessionId, p.id);
    expect((await viewSession(r.a1.id, r.sessionId, r.A.id)).result?.isMatch).toBe(true);
    await db.gameRuleVersion.delete({ where: { version: 99 } });
    await db.gameRuleVersion.update({ where: { version: 1 }, data: { active: true } });
  });

  it("Blockierung beendet die Runde", async () => {
    const r = await startRound();
    await blockProfile(r.a1.id, r.A.id, r.B.id);
    expect((await db.gameSession.findUniqueOrThrow({ where: { id: r.sessionId } })).status).toBe("cancelled");
    await expect(setAnswer(r.b1.id, r.sessionId, r.B.id, r.questions[0].key, "o1")).rejects.toMatchObject({ code: "closed" });
  });
});
