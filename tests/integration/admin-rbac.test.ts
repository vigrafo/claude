import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { hasPermission, ROLES } from "@/server/rbac";
import { setProviderEnabled, setProviderMode, setProviderSecret } from "@/server/admin/providers";
import { approvePending, rejectPending } from "@/server/admin/approvals";
import { requestRoleGrant, revokeRole } from "@/server/admin/roles";
import { ipAllowed, reauthFresh, requireRecentReauth } from "@/server/admin/guard";
import { safeAdminNext, makeEnrolToken, readEnrolToken } from "@/server/admin/session";
import { decrypt as decryptForTest } from "@/server/crypto";
import { makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

async function withRole(roleKey: string) {
  const u = await makeUser();
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.roleAssignment.create({ data: { userId: u.id, roleId: role.id } });
  return u;
}

describe("Admin – Rollenmatrix", () => {
  it("Support hat keinen Zugriff auf Zahlungsanbieter", async () => {
    const s = await withRole("support");
    expect(await hasPermission(s.id, "providers.manage")).toBe(false);
    await expect(setProviderEnabled(s.id, "test", true)).rejects.toMatchObject({ status: 403 });
    await expect(setProviderSecret(s.id, "test", "geheim-123456")).rejects.toMatchObject({ status: 403 });
  });

  it("Plattformadmin hat keine Beleg-Rechte (verification.evidence, moderation.evidence)", async () => {
    const a = await withRole("platform_admin");
    expect(await hasPermission(a.id, "admin.access")).toBe(true);
    expect(await hasPermission(a.id, "verification.evidence")).toBe(false);
    expect(await hasPermission(a.id, "moderation.evidence")).toBe(false);
    const sa = await withRole("superadmin");
    expect(await hasPermission(sa.id, "verification.evidence")).toBe(false);
    expect(await hasPermission(sa.id, "moderation.evidence")).toBe(false);
  });

  it("Gruppenmoderator/Veranstalter haben keinen Adminzugang", async () => {
    expect(ROLES.group_moderator.permissions).toHaveLength(0);
    const o = await withRole("organizer");
    expect(await hasPermission(o.id, "admin.access")).toBe(false);
  });
});

describe("Admin – Vier-Augen-Prinzip bei kritischen Rollen", () => {
  it("kritische Rolle → Antrag; Antragsteller kann nicht selbst freigeben; zweite Person schon", async () => {
    const a1 = await withRole("superadmin");
    const a2 = await withRole("superadmin");
    const target = await makeUser();
    const r = await requestRoleGrant(a1.id, target.email, "finance", "Neue Buchhaltung");
    expect(r.status).toBe("pending");
    expect(await hasPermission(target.id, "finance.read")).toBe(false);
    if (r.status !== "pending") throw new Error("unreachable");
    await expect(approvePending(r.approvalId, a1.id)).rejects.toMatchObject({ status: 403 });
    await approvePending(r.approvalId, a2.id);
    expect(await hasPermission(target.id, "finance.read")).toBe(true);
    const ra = await db.roleAssignment.findFirstOrThrow({ where: { userId: target.id, revokedAt: null } });
    expect(ra.grantedBy).toBe(a1.id);
    expect(ra.approvedBy).toBe(a2.id);
    await expect(approvePending(r.approvalId, a2.id)).rejects.toMatchObject({ code: "decided" });
  });

  it("nicht kritische Rolle wird direkt vergeben; eigene Rollen sind tabu; Ablehnung wirkt", async () => {
    const a1 = await withRole("superadmin");
    const a2 = await withRole("superadmin");
    const t = await makeUser();
    expect((await requestRoleGrant(a1.id, t.email, "support", "Supportteam")).status).toBe("granted");
    expect(await hasPermission(t.id, "support.handle")).toBe(true);
    await expect(requestRoleGrant(a1.id, a1.email, "verifier", "Selbstvergabe")).rejects.toMatchObject({ status: 403 });
    const p = await requestRoleGrant(a1.id, t.email, "platform_admin", "Teamleitung");
    if (p.status !== "pending") throw new Error("expected pending");
    await rejectPending(p.approvalId, a2.id);
    expect(await hasPermission(t.id, "users.manage")).toBe(false);
    const asg = await db.roleAssignment.findFirstOrThrow({ where: { userId: t.id, revokedAt: null } });
    await revokeRole(a1.id, asg.id, "Wechsel ins andere Team");
    expect(await hasPermission(t.id, "support.handle")).toBe(false);
  });

  it("Rollenvergabe ohne roles.manage wird abgelehnt", async () => {
    const f = await withRole("finance");
    const t = await makeUser();
    await expect(requestRoleGrant(f.id, t.email, "support", "Test Test")).rejects.toMatchObject({ status: 403 });
  });
});

describe("Admin – Zahlungsanbieter", () => {
  it("Aktivierung für nicht implementierte Anbieter wird verweigert; live für Sandbox-Adapter gesperrt", async () => {
    const f = await withRole("finance");
    await expect(setProviderEnabled(f.id, "segpay", true)).rejects.toMatchObject({ code: "cannot_enable" });
    await expect(setProviderEnabled(f.id, "stripe", true)).rejects.toMatchObject({ code: "cannot_enable" });
    await expect(setProviderMode(f.id, "test", "live")).rejects.toMatchObject({ code: "live_blocked" });
    const seg = await db.providerConfiguration.findUniqueOrThrow({ where: { key: "segpay" } });
    expect(seg.enabled).toBe(false);
  });

  it("Secrets werden nur verschlüsselt + maskiert gespeichert", async () => {
    const f = await withRole("finance");
    await setProviderSecret(f.id, "ccbill", "supergeheim-abcd");
    const c = await db.providerConfiguration.findUniqueOrThrow({ where: { key: "ccbill" } });
    expect(c.secretHint).toBe("••••abcd");
    expect(c.secretRef).not.toContain("supergeheim");
    expect(decryptForTest(c.secretRef!)).toBe("supergeheim-abcd");
    const ev = await db.auditEvent.findFirstOrThrow({ where: { action: "provider.secret_set", targetId: "ccbill" }, orderBy: { seq: "desc" } });
    expect(JSON.stringify(ev.meta)).not.toContain("supergeheim");
  });
});

describe("Admin – Schutzfunktionen", () => {
  it("IP-Allowlist, Re-Auth-Frist, sichere Rücksprungziele, Enrolment-Token", () => {
    expect(ipAllowed("1.2.3.4", "")).toBe(true);
    expect(ipAllowed("1.2.3.4", "1.2.3.4, 5.6.7.8")).toBe(true);
    expect(ipAllowed("9.9.9.9", "1.2.3.4")).toBe(false);
    expect(reauthFresh(new Date())).toBe(true);
    expect(reauthFresh(new Date(Date.now() - 60 * 60_000))).toBe(false);
    expect(() => requireRecentReauth({ session: { reauthAt: null } })).toThrow();
    expect(safeAdminNext("https://evil.example")).toBe("/admin");
    expect(safeAdminNext("//evil.example")).toBe("/admin");
    expect(safeAdminNext("/admin/finanzen")).toBe("/admin/finanzen");
    const t = makeEnrolToken("u1", "SECRET");
    expect(readEnrolToken(t)).toEqual({ userId: "u1", secret: "SECRET" });
    expect(readEnrolToken(makeEnrolToken("u1", "S", Date.now() - 3600_000))).toBeNull();
    expect(readEnrolToken("garbage")).toBeNull();
  });
});
