import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPlanVersion, grantPlanEntitlement } from "@/server/admin/plans";
import { requestTokenAdjust } from "@/server/admin/tokens";
import { approvePending } from "@/server/admin/approvals";
import { createQuestion, editQuestion, approveQuestion, previewEvaluation, createRuleVersion, activateRuleVersion } from "@/server/admin/games";
import { setUserStatus } from "@/server/admin/users";
import { transitionGoldContent, createGoldContent, savePublicPage } from "@/server/admin/content";
import { accessMessageEvidence } from "@/server/admin/moderation";
import { activePlan } from "@/server/state";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

async function withRole(roleKey: string) {
  const u = await makeUser();
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.roleAssignment.create({ data: { userId: u.id, roleId: role.id } });
  return u;
}

describe("Admin – Tarife", () => {
  it("neue Preisversion ändert bestehende Versionen und Abos nicht; validFrom muss in der Zukunft liegen", async () => {
    const a = await withRole("platform_admin");
    const v1 = await db.planVersion.findFirstOrThrow({ where: { plan: "premium", version: 1 } });
    const u = await makeUser();
    const sub = await db.subscription.create({ data: { userId: u.id, plan: "premium", planVersionId: v1.id, provider: "test", providerSubId: `s_${u.id}`, status: "active" } });
    await expect(createPlanVersion(a.id, { plan: "premium", priceCents: 1600, introPriceCents: 800, introMonths: 24, validFrom: new Date(Date.now() - 1000) }))
      .rejects.toMatchObject({ code: "valid_from" });
    const v2 = await createPlanVersion(a.id, { plan: "premium", priceCents: 1600, introPriceCents: 800, introMonths: 24, validFrom: new Date(Date.now() + 30 * 86400_000) });
    expect(v2.version).toBeGreaterThan(1);
    const v1After = await db.planVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After).toEqual(v1);
    expect((await db.subscription.findUniqueOrThrow({ where: { id: sub.id } })).planVersionId).toBe(v1.id);
  });

  it("Premium-/Gold-Entitlement für nicht verifizierte Person wird blockiert", async () => {
    const a = await withRole("platform_admin");
    const u = await makeUser({ verified: false });
    await expect(grantPlanEntitlement(a.id, u.id, "premium", null, "Kulanz nach Störung")).rejects.toMatchObject({ code: "verification_required" });
    await expect(grantPlanEntitlement(a.id, u.id, "gold", null, "Kulanz nach Störung")).rejects.toMatchObject({ code: "verification_required" });
    expect(await activePlan(u.id)).toBe("basis");
    const v = await makeUser();
    await grantPlanEntitlement(a.id, v.id, "gold", new Date(Date.now() + 86400_000), "Kulanz nach Störung");
    expect(await activePlan(v.id)).toBe("gold");
  });
});

describe("Admin – Tokenkorrektur", () => {
  it("> 100 Tokens nur mit Freigabe durch zweite Person; Antragsteller kann nicht selbst freigeben", async () => {
    const a1 = await withRole("finance");
    const a2 = await withRole("finance");
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    expect((await requestTokenAdjust(a1.id, p.handle, 50, "Kulanzgutschrift Störung")).status).toBe("done");
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: p.id } })).tokenBalance).toBe(50);
    const r = await requestTokenAdjust(a1.id, p.handle, 500, "Große Korrektur nach Abgleich");
    expect(r.status).toBe("pending");
    if (r.status !== "pending") throw new Error("unreachable");
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: p.id } })).tokenBalance).toBe(50);
    await expect(approvePending(r.approvalId, a1.id)).rejects.toMatchObject({ status: 403 });
    await approvePending(r.approvalId, a2.id);
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: p.id } })).tokenBalance).toBe(550);
    const entry = await db.tokenLedgerEntry.findFirstOrThrow({ where: { profileId: p.id, delta: 500 } });
    expect(entry.actorUserId).toBe(a1.id);
    const support = await withRole("support");
    await expect(requestTokenAdjust(support.id, p.handle, 5, "Nicht berechtigt")).rejects.toMatchObject({ status: 403 });
  });
});

describe("Admin – Spiele", () => {
  it("Bearbeiten erzeugt neue Version; freigegebene Version bleibt unverändert", async () => {
    const a = await withRole("platform_admin");
    const orig = await db.gameQuestionVersion.findFirstOrThrow({ where: { status: "approved", variant: "either_or" }, include: { options: true } });
    const next = await editQuestion(a.id, orig.id, { category: orig.category, text: `${orig.text} (neu)`, options: ["Ja", "Nein", "Vielleicht"] });
    expect(next.questionKey).toBe(orig.questionKey);
    expect(next.version).toBe(orig.version + 1);
    expect(next.status).toBe("draft");
    const after = await db.gameQuestionVersion.findUniqueOrThrow({ where: { id: orig.id }, include: { options: true } });
    expect(after.text).toBe(orig.text);
    expect(after.options.length).toBe(orig.options.length);
    expect(after.status).toBe("approved");
    await approveQuestion(a.id, next.id);
    expect((await db.gameQuestionVersion.findUniqueOrThrow({ where: { id: orig.id } })).status).toBe("archived");
    expect((await db.gameQuestionVersion.findUniqueOrThrow({ where: { id: orig.id } })).text).toBe(orig.text);
    const q = await createQuestion(a.id, { variant: "what_matters", category: "Umgang", text: "Wie plant ihr ein erstes Treffen?", options: ["Spontan", "Geplant"] });
    expect(q.status).toBe("draft");
  });

  it("Testauswertung ohne Datenbank und Regelversionen", async () => {
    const r = previewEvaluation({ roundSize: 10, minAnswered: 8, thresholdBp: 8000 }, "o1 o1 o2 o2 o1 o1 o1 o1 o1 o1", "o1 o1 o2 o2 o1 o1 o1 o1 o2 o2");
    expect(r).toMatchObject({ status: "match", answeredBoth: 10, hits: 8 });
    const a = await withRole("platform_admin");
    await expect(createRuleVersion(a.id, { roundSize: 10, minAnswered: 12, thresholdBp: 8000, inviteLimitPerDay: 5, expiresHours: 168 })).rejects.toMatchObject({ code: "rules" });
    const rv = await createRuleVersion(a.id, { roundSize: 10, minAnswered: 8, thresholdBp: 7500, inviteLimitPerDay: 5, expiresHours: 168 });
    await activateRuleVersion(a.id, rv.id);
    expect(await db.gameRuleVersion.count({ where: { active: true } })).toBe(1);
  });
});

describe("Admin – Personen, Inhalte, Belege", () => {
  it("Sperre widerruft Sitzungen; Rechte werden geprüft", async () => {
    const a = await withRole("platform_admin");
    const u = await makeUser();
    await db.session.create({ data: { tokenHash: `h_${u.id}`, userId: u.id, expiresAt: new Date(Date.now() + 86400_000) } });
    await setUserStatus(a.id, u.id, "suspended", "Wiederholte Belästigung");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("suspended");
    expect(await db.session.count({ where: { userId: u.id, revokedAt: null } })).toBe(0);
    const s = await withRole("support");
    await expect(setUserStatus(s.id, u.id, "active", "Entsperren bitte")).rejects.toMatchObject({ status: 403 });
  });

  it("Gold-Inhalt nur mit Rechtenachweis veröffentlichen; Seiten nur Klartext", async () => {
    const e = await withRole("editor");
    const c = await createGoldContent(e.id, { slug: `test-${Date.now()}`, title: "Workshop Kommunikation", kind: "workshop", category: "Wissen", summary: "Kurzer Überblick zum Workshop.", body: "Inhalt des Workshops mit genug Text." });
    await transitionGoldContent(e.id, c.id, "review");
    await expect(transitionGoldContent(e.id, c.id, "published")).rejects.toMatchObject({ code: "rights" });
    const page = await db.publicPage.findFirstOrThrow();
    await expect(savePublicPage(e.id, page.id, { title: "X Titel", body: "<script>alert(1)</script>" })).rejects.toMatchObject({ code: "html_not_allowed" });
  });

  it("Plattformadmin kann gemeldete Nachrichten nicht einsehen", async () => {
    const a = await withRole("platform_admin");
    const r = await db.report.create({ data: { reporterUserId: a.id, targetType: "message", targetId: "x", reason: "spam" } });
    await expect(accessMessageEvidence(a.id, r.id, "Prüfung der Meldung wegen Spam")).rejects.toMatchObject({ status: 403 });
  });
});
