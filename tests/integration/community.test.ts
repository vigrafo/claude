import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  applyAsModerator, applyForGroup, createThread, decideGroup, decideModeratorApplication, joinGroup, listVisibleGroups, moderateGroupMember,
} from "@/server/community";
import { reserveTicket, cancelTicketOrder } from "@/server/events";
import { handleWebhook } from "@/server/payments/service";
import { hasPermission, isGroupModerator } from "@/server/rbac";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

async function admin(roleKey = "platform_admin") {
  const u = await makeUser();
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.roleAssignment.create({ data: { userId: u.id, roleId: role.id } });
  return u;
}

describe("Gruppen & Moderation", () => {
  it("Gruppen sind vor Adminfreigabe unsichtbar; Mitglieder/Moderatoren können keine Freigabe erzwingen", async () => {
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    const g = await applyForGroup(u.id, p.id, { name: "Testgruppe Wandern", description: "Wir wandern gern gemeinsam am Wochenende.", category: "Freizeit", visibility: "open" });
    expect((await listVisibleGroups(p.id)).some((x) => x.id === g.id)).toBe(false);
    await expect(decideGroup(u.id, g.id, "approved")).rejects.toMatchObject({ status: 403 });
    const a = await admin();
    await decideGroup(a.id, g.id, "approved");
    expect((await listVisibleGroups(p.id)).some((x) => x.id === g.id)).toBe(true);
  });

  it("nicht verifizierte Profile erreichen keine Community-Funktionen", async () => {
    const u = await makeUser({ verified: false });
    const p = await makeProfile("single", [u]);
    await expect(applyForGroup(u.id, p.id, { name: "abc def", description: "x".repeat(30), category: "x", visibility: "open" })).rejects.toMatchObject({ status: 403 });
    const g = await db.group.findFirstOrThrow({ where: { official: true } });
    await expect(joinGroup(u.id, p.id, g.id)).rejects.toMatchObject({ status: 403 });
  });

  it("Moderator-Bewerbung: keine Doppelbewerbung, Ernennung nur durch Admin, Rolle nur für diese Gruppe ohne Adminzugang", async () => {
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    const g = await db.group.findFirstOrThrow({ where: { official: true } });
    await joinGroup(u.id, p.id, g.id);
    const app = await applyAsModerator(u.id, p.id, g.id, "Ich möchte helfen, den Austausch freundlich und respektvoll zu halten.");
    await expect(applyAsModerator(u.id, p.id, g.id, "Noch einmal möchte ich mich bewerben, weil es mir wichtig ist.")).rejects.toMatchObject({ code: "duplicate" });
    await expect(decideModeratorApplication(u.id, app.id, true)).rejects.toMatchObject({ status: 403 });
    const a = await admin();
    await decideModeratorApplication(a.id, app.id, true);
    expect(await isGroupModerator(u.id, g.id)).toBe(true);
    expect(await hasPermission(u.id, "admin.access")).toBe(false);
    const other = await db.group.findFirstOrThrow({ where: { official: true, id: { not: g.id } } });
    expect(await isGroupModerator(u.id, other.id)).toBe(false);
    // lokale Moderation: Schreibrecht entziehen
    const u2 = await makeUser();
    const p2 = await makeProfile("single", [u2]);
    await joinGroup(u2.id, p2.id, g.id);
    await moderateGroupMember(u.id, g.id, p2.id, "mute");
    const cat = await db.forumCategory.findFirstOrThrow({ where: { groupId: g.id } });
    await expect(createThread(u2.id, p2.id, cat.id, "Hallo zusammen", "Text")).rejects.toMatchObject({ status: 403 });
  });
});

describe("Events & Gold-Rabatt", () => {
  async function setupEvent(priceCents = 3000) {
    const ou = await makeUser();
    const op = await makeProfile("single", [ou]);
    const org = await db.organizer.create({ data: { profileId: op.id, legalName: "eropub Events", contactEmail: "e@x.de", responsibleUserId: ou.id, status: "approved", isPartner: true } });
    const ev = await db.event.create({
      data: {
        organizerId: org.id, title: "Testparty", description: "x", regionCountry: "DE", startsAt: new Date(Date.now() + 7 * 86400_000),
        endsAt: new Date(Date.now() + 7 * 86400_000 + 3600_000), capacity: 50, status: "approved", goldDiscountEligible: true, isEropubEvent: true,
        ticketTypes: { create: [{ name: "Paarticket", priceCents, feeCents: 200, quota: 50, personsPerTicket: 2 }] },
      },
      include: { ticketTypes: true },
    });
    return ev;
  }

  it("Rabatt pro Event/Profil maximal einmal, auch bei parallelem Checkout; Storno gibt Reservierung frei", async () => {
    const ev = await setupEvent();
    const u = await makeUser({ plan: "gold" });
    const p = await makeProfile("single", [u]);
    const results = await Promise.all(Array.from({ length: 4 }, () => reserveTicket(u.id, p.id, ev.ticketTypes[0].id)));
    expect(results.filter((r) => r.discount.discountCents > 0 && r.order.discountCents > 0).length).toBe(1);
    expect(await db.discountRedemption.count({ where: { eventId: ev.id, profileId: p.id, status: "reserved" } })).toBe(1);
    const withDiscount = results.find((r) => r.order.discountCents > 0)!;
    expect(withDiscount.order.payableCents).toBe(2200);
    await cancelTicketOrder(u.id, withDiscount.order.id);
    const again = await reserveTicket(u.id, p.id, ev.ticketTypes[0].id);
    expect(again.order.discountCents).toBe(1000);
  });

  it("kein Rabatt ohne Gold", async () => {
    const ev = await setupEvent();
    const u = await makeUser({ plan: "premium" });
    const p = await makeProfile("single", [u]);
    expect((await reserveTicket(u.id, p.id, ev.ticketTypes[0].id)).order.discountCents).toBe(0);
  });

  it("Rückerstattung gibt Rabatt frei", async () => {
    const ev = await setupEvent();
    const u = await makeUser({ plan: "gold" });
    const p = await makeProfile("single", [u]);
    const r = await reserveTicket(u.id, p.id, ev.ticketTypes[0].id);
    const order = await db.order.create({
      data: { userId: u.id, kind: "ticket", refKey: r.order.id, amountCents: r.order.payableCents, provider: "test", idemKey: `t_${r.order.id}`, status: "paid", fulfilledAt: new Date() },
    });
    const { signTestPayload, TEST_MERCHANT_ID } = await import("@/server/payments/test-adapter");
    const raw = JSON.stringify({ eventId: `rf_${order.id}`, type: "refund", orderId: order.id, merchantId: TEST_MERCHANT_ID, timestamp: Date.now(), amountCents: order.amountCents, currency: "EUR" });
    await handleWebhook("test", { rawBody: raw, headers: { "x-test-signature": signTestPayload(raw) }, query: {} });
    expect((await db.discountRedemption.findUniqueOrThrow({ where: { ticketOrderId: r.order.id } })).status).toBe("released");
  });
});
