import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { deleteUserData, reapplyDeletions, runDeletions, sendPriceNotices, handlers } from "@/server/jobs";
import { processOutboxBatch } from "@/server/outbox";
import { introPriceEndsAt } from "@/domain/plans";
import { verifyAuditChain, audit } from "@/server/audit";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

describe("Worker-Jobs", () => {
  it("Löschlauf entfernt personenbezogene Daten und erzeugt Tombstone; Restore wird erneut bereinigt", async () => {
    const u = await makeUser({ email: "loesch@test.local" });
    const p = await makeProfile("single", [u]);
    await db.deletionRequest.create({ data: { userId: u.id, scheduledFor: new Date(Date.now() - 1000) } });
    await runDeletions();
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.status).toBe("deleted");
    expect(after.email).not.toContain("loesch");
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("deleted");
    // Simulierter Restore: alter Datenstand kommt zurück
    await db.user.update({ where: { id: u.id }, data: { status: "active", email: "loesch@test.local" } });
    expect(await reapplyDeletions()).toBeGreaterThanOrEqual(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).not.toContain("loesch");
    await deleteUserData("does-not-exist");
  });

  it("Preis-Hinweis 30 Tage vor dem ersten 14-€-Betrag, nur einmal", async () => {
    const u = await makeUser({ plan: "premium" });
    const first = new Date(Date.now() - (24 * 30 - 20) * 86400_000);
    await db.premiumClock.create({ data: { userId: u.id, firstPremiumActivatedAt: first, introPriceEndsAt: introPriceEndsAt(first), source: "premium" } });
    const pv = await db.planVersion.findFirstOrThrow({ where: { plan: "premium" } });
    await db.subscription.create({
      data: { userId: u.id, plan: "premium", planVersionId: pv.id, provider: "test", providerSubId: `ps_${u.id}`, status: "active", currentPeriodStart: first, currentPeriodEnd: new Date(Date.now() + 10 * 86400_000) },
    });
    expect(await sendPriceNotices()).toBeGreaterThanOrEqual(1);
    const before = await db.notification.count({ where: { userId: u.id, kind: "billing" } });
    await sendPriceNotices();
    expect(await db.notification.count({ where: { userId: u.id, kind: "billing" } })).toBe(before);
  });

  it("Outbox: Benachrichtigung neutral, ohne Nachrichteninhalt", async () => {
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    await db.outboxEvent.create({ data: { topic: "message.created", payload: { toProfileId: p.id, conversationId: "c1", messageId: "m1" } } });
    await processOutboxBatch(handlers, 50);
    const n = await db.notification.findFirstOrThrow({ where: { userId: u.id } });
    expect(n.title).toBe("Du hast eine neue Nachricht");
  });

  it("Audit-Kette ist verifizierbar", async () => {
    await audit("test.event", { meta: { b: 1, a: "x" } });
    expect((await verifyAuditChain()).ok).toBe(true);
  });
});
