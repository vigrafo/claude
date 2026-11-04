import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createReport } from "@/server/reports";
import { createDate, searchDates, closeDate } from "@/server/dates";
import { markRead, listNotifications } from "@/server/notifications";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

describe("Meldungen", () => {
  it("legt einen Moderationsfall mit Nummer an und ordnet weitere Meldungen demselben Fall zu", async () => {
    const u1 = await makeUser();
    const p1 = await makeProfile("single", [u1]);
    const u2 = await makeUser();
    const p2 = await makeProfile("single", [u2]);
    const target = await makeProfile("single", [await makeUser()]);
    const r1 = await createReport(u1.id, p1.id, { targetType: "profile", targetId: target.id, reason: "scam", details: "Fragt nach Geld." });
    expect(r1.caseNumber).toMatch(/^M-\d{6}$/);
    const r2 = await createReport(u2.id, p2.id, { targetType: "profile", targetId: target.id, reason: "minor" });
    expect(r2.caseId).toBe(r1.caseId);
    const mc = await db.moderationCase.findUniqueOrThrow({ where: { id: r1.caseId } });
    expect(mc.priority).toBe(100);
    expect(await db.report.count({ where: { caseId: mc.id } })).toBe(2);
    await expect(createReport(u1.id, p1.id, { targetType: "profile", targetId: target.id, reason: "unbekannt" })).rejects.toMatchObject({ code: "reason" });
    // fremdes Profil
    await expect(createReport(u1.id, p2.id, { targetType: "profile", targetId: target.id, reason: "scam" })).rejects.toMatchObject({ status: 403 });
  });

  it("Nachrichten dürfen nur von Teilnehmenden gemeldet werden", async () => {
    const u1 = await makeUser();
    const p1 = await makeProfile("single", [u1]);
    const p2 = await makeProfile("single", [await makeUser()]);
    const conv = await db.conversation.create({ data: { pairKey: `${p2.id}:x${p1.id}` } });
    const msg = await db.message.create({ data: { conversationId: conv.id, senderProfileId: p2.id, senderUserId: "x", body: "Hallo", clientKey: "k1" } });
    await expect(createReport(u1.id, p1.id, { targetType: "message", targetId: msg.id, reason: "harassment" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("Dates", () => {
  it("nur für verifizierte Profile; Suche über PLZ-Präfix; Schließen nur durch Eigentümer", async () => {
    const un = await makeUser({ verified: false });
    const pn = await makeProfile("single", [un]);
    const input = { kind: "personal" as const, title: "Kaffee am Sonntag", description: "Entspannt kennenlernen im Café.", postalCode: "10115", country: "DE" };
    await expect(createDate(un.id, pn.id, input)).rejects.toMatchObject({ status: 403 });
    await expect(searchDates(un.id, pn.id, { country: "DE" })).rejects.toMatchObject({ status: 403 });

    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    const d = await createDate(u.id, p.id, input);
    await expect(createDate(u.id, p.id, { ...input, description: "x".repeat(2001) })).rejects.toMatchObject({ code: "description" });
    const u2 = await makeUser();
    const p2 = await makeProfile("single", [u2]);
    expect((await searchDates(u2.id, p2.id, { country: "DE", postalCode: "10178", radiusKm: 25 })).some((x) => x.id === d.id)).toBe(true);
    expect((await searchDates(u2.id, p2.id, { country: "DE", postalCode: "80331", radiusKm: 25 })).some((x) => x.id === d.id)).toBe(false);
    await expect(closeDate(u2.id, p2.id, d.id)).rejects.toMatchObject({ status: 404 });
    await closeDate(u.id, p.id, d.id);
    expect((await searchDates(u2.id, p2.id, { country: "DE" })).some((x) => x.id === d.id)).toBe(false);
  });
});

describe("Benachrichtigungen", () => {
  it("markiert nur eigene Benachrichtigungen als gelesen", async () => {
    const u1 = await makeUser();
    const u2 = await makeUser();
    const n = await db.notification.create({ data: { userId: u2.id, kind: "x", title: "Neue Aktivität" } });
    expect(await markRead(u1.id, n.id)).toBe(0);
    expect(await markRead(u2.id, n.id)).toBe(1);
    expect((await listNotifications(u2.id))[0].readAt).not.toBeNull();
  });
});
