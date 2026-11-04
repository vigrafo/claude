import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { sendMessage } from "@/server/messaging";
import { ledgerBalance } from "@/server/tokens";
import { blockProfile } from "@/server/safety";
import { connect, makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

describe("Nachrichten & Token-Ledger", () => {
  it("Basisnachricht kostet exakt einmal; Wiederholung mit gleichem Schlüssel kostet nichts", async () => {
    const ua = await makeUser({ verified: false });
    const ub = await makeUser();
    const a = await makeProfile("single", [ua], 5);
    const b = await makeProfile("single", [ub]);
    await connect(a.id, b.id);
    const r1 = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Hallo!", clientKey: "k1" });
    const r2 = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Hallo!", clientKey: "k1" });
    expect(r1.tokenCost).toBe(1);
    expect(r2.duplicate).toBe(true);
    expect(r1.messageId).toBe(r2.messageId);
    expect(await ledgerBalance(a.id)).toBe(4);
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: a.id } })).tokenBalance).toBe(4);
  });

  it("parallele Requests: kein Doppelverbrauch, kein negatives Guthaben", async () => {
    const ua = await makeUser({ verified: false });
    const ub = await makeUser();
    const a = await makeProfile("single", [ua], 3);
    const b = await makeProfile("single", [ub]);
    await connect(a.id, b.id);
    // 3 gleiche Schlüssel + 5 unterschiedliche, bei 3 Tokens Guthaben
    const reqs = [
      ...Array.from({ length: 3 }, () => ({ key: "same" })),
      ...Array.from({ length: 5 }, (_, i) => ({ key: `d${i}` })),
    ].map((r) => sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "x", clientKey: r.key }).then((x) => x, (e) => e));
    const results = await Promise.all(reqs);
    const msgs = await db.message.count({ where: { senderProfileId: a.id } });
    expect(msgs).toBe(3);
    expect(await ledgerBalance(a.id)).toBe(0);
    expect(results.filter((r) => r instanceof Error).every((e) => (e as { code?: string }).code === "insufficient_tokens")).toBe(true);
  });

  it("abgewiesene Nachricht kostet nichts (ohne Guthaben, blockiert, zu lang)", async () => {
    const ua = await makeUser({ verified: false });
    const ub = await makeUser();
    const a = await makeProfile("single", [ua], 0);
    const b = await makeProfile("single", [ub]);
    await connect(a.id, b.id);
    await expect(sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "x", clientKey: "z" })).rejects.toMatchObject({ code: "insufficient_tokens" });
    expect(await db.message.count({ where: { senderProfileId: a.id } })).toBe(0);

    const uc = await makeUser({ verified: false });
    const c = await makeProfile("single", [uc], 5);
    await connect(c.id, b.id);
    await blockProfile(ub.id, b.id, c.id);
    await expect(sendMessage({ actorUserId: uc.id, fromProfileId: c.id, toProfileId: b.id, body: "x", clientKey: "y" })).rejects.toMatchObject({ status: 403 });
    await expect(sendMessage({ actorUserId: uc.id, fromProfileId: c.id, toProfileId: b.id, body: "a".repeat(2001), clientKey: "w" })).rejects.toMatchObject({ code: "invalid_body" });
    expect(await ledgerBalance(c.id)).toBe(5);
  });

  it("Premium/Gold (verifiziert) schreiben ohne Tokens; Basis kann ohne Guthaben nicht antworten", async () => {
    const up = await makeUser({ plan: "premium" });
    const ub = await makeUser({ verified: false });
    const p = await makeProfile("single", [up], 0);
    const b = await makeProfile("single", [ub], 0);
    await connect(p.id, b.id);
    const r = await sendMessage({ actorUserId: up.id, fromProfileId: p.id, toProfileId: b.id, body: "Hi", clientKey: "p1" });
    expect(r.tokenCost).toBe(0);
    await expect(sendMessage({ actorUserId: ub.id, fromProfileId: b.id, toProfileId: p.id, body: "Hi zurück", clientKey: "b1" })).rejects.toMatchObject({ code: "insufficient_tokens" });
  });

  it("Premium ohne Identitätsprüfung zahlt Tokens", async () => {
    const up = await makeUser({ plan: "premium", verified: false });
    const ub = await makeUser();
    const p = await makeProfile("single", [up], 2);
    const b = await makeProfile("single", [ub]);
    await connect(p.id, b.id);
    const r = await sendMessage({ actorUserId: up.id, fromProfileId: p.id, toProfileId: b.id, body: "Hi", clientKey: "p1" });
    expect(r.tokenCost).toBe(1);
  });

  it("Fremde: genau eine Nachrichtenanfrage, danach gesperrt bis zur Annahme; Antwort = Annahme", async () => {
    const ua = await makeUser({ verified: false });
    const ub = await makeUser({ verified: false });
    const a = await makeProfile("single", [ua], 5);
    const b = await makeProfile("single", [ub], 5);
    const r1 = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Hallo", clientKey: "1" });
    expect(r1.isRequest).toBe(true);
    await expect(sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Noch mal", clientKey: "2" })).rejects.toMatchObject({ status: 403 });
    expect(await ledgerBalance(a.id)).toBe(4); // Anfrage zählt als gesendete Nachricht
    await sendMessage({ actorUserId: ub.id, fromProfileId: b.id, toProfileId: a.id, body: "Hi!", clientKey: "3" });
    await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Schön", clientKey: "4" });
    expect(await db.message.count({ where: { conversationId: r1.conversationId } })).toBe(3);
  });

  it("Paarprofil: Absenderkennung der Person wird gespeichert, Tokens gehören dem Profil", async () => {
    const u1 = await makeUser({ verified: false });
    const u2 = await makeUser({ verified: false });
    const ub = await makeUser();
    const couple = await makeProfile("couple", [u1, u2], 2);
    const b = await makeProfile("single", [ub]);
    await connect(couple.id, b.id);
    await sendMessage({ actorUserId: u1.id, fromProfileId: couple.id, toProfileId: b.id, body: "von A", clientKey: "a" });
    const m2 = await sendMessage({ actorUserId: u2.id, fromProfileId: couple.id, toProfileId: b.id, body: "von B", clientKey: "b" });
    expect(m2.balance).toBe(0);
    const msgs = await db.message.findMany({ where: { senderProfileId: couple.id }, orderBy: { createdAt: "asc" } });
    expect(msgs.map((m) => m.senderLabel)).toEqual(["A", "B"]);
    expect(msgs.map((m) => m.senderUserId)).toEqual([u1.id, u2.id]);
  });

  it("Geschenk: serverseitige Kosten, Begleittext max. 500", async () => {
    const ua = await makeUser({ plan: "gold" });
    const ub = await makeUser();
    const a = await makeProfile("single", [ua], 10);
    const b = await makeProfile("single", [ub]);
    await connect(a.id, b.id);
    const r = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Für dich", clientKey: "g", kind: "gift", giftKey: "rose" });
    expect(r.tokenCost).toBe(2); // Gold: Nachricht frei, Geschenk kostet
    await expect(sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "a".repeat(501), clientKey: "g2", kind: "gift", giftKey: "rose" })).rejects.toMatchObject({ code: "invalid_body" });
  });
});
