import { beforeAll, describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth";
import { adminLoginCheck, completeEnrolment, reauthenticate, startAdminSession } from "@/server/admin/session";
import { confirmBankTransfer } from "@/server/admin/finance";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

async function adminWithPassword(roleKey: string, pw: string) {
  const u = await makeUser();
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.roleAssignment.create({ data: { userId: u.id, roleId: role.id } });
  return u;
}

describe("Admin – Anmeldung mit Pflicht-MFA", () => {
  it("ohne MFA → Einrichtung erzwingen; danach Login nur mit gültigem Code; Sitzung mit mfaAt", async () => {
    const pw = "ein-sicheres-passwort-1";
    const u = await adminWithPassword("support", pw);
    await expect(adminLoginCheck(u.email, "falsch-falsch-falsch", "")).rejects.toMatchObject({ code: "login" });
    const r = await adminLoginCheck(u.email, pw, "");
    expect(r.status).toBe("enrol");
    if (r.status !== "enrol") throw new Error("unreachable");
    await expect(completeEnrolment(r.enrolToken, "000000")).rejects.toMatchObject({ code: "mfa_invalid" });
    const id = await completeEnrolment(r.enrolToken, authenticator.generate(r.secret));
    expect(id).toBe(u.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).mfaEnabledAt).not.toBeNull();
    expect((await adminLoginCheck(u.email, pw, "")).status).toBe("need_otp");
    await expect(adminLoginCheck(u.email, pw, "123456")).rejects.toMatchObject({ code: "login" });
    const ok = await adminLoginCheck(u.email, pw, authenticator.generate(r.secret));
    expect(ok.status).toBe("ok");
    const s = await startAdminSession(u.id);
    const row = await db.session.findFirstOrThrow({ where: { userId: u.id, isAdmin: true } });
    expect(row.mfaAt).not.toBeNull();
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(8 * 3600_000 + 1000);
    expect(s.token).toBeTruthy();
    await expect(reauthenticate(row.id, u.id, "000000")).rejects.toMatchObject({ code: "mfa_invalid" });
  });

  it("Personen ohne admin.access erhalten keine Adminsitzung", async () => {
    const pw = "ein-sicheres-passwort-2";
    const u = await makeUser();
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
    await expect(adminLoginCheck(u.email, pw, "")).rejects.toMatchObject({ code: "login" });
  });
});

describe("Admin – Banküberweisung", () => {
  it("erzeugt Payment (bank_transfer), erfüllt idempotent, keine Doppelbuchung", async () => {
    const f = await makeUser();
    const role = await db.role.findUniqueOrThrow({ where: { key: "finance" } });
    await db.roleAssignment.create({ data: { userId: f.id, roleId: role.id } });
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    const pkg = await db.tokenPackageVersion.findFirstOrThrow({ where: { key: "t20" }, orderBy: { version: "asc" } });
    const order = await db.order.create({ data: { userId: u.id, profileId: p.id, kind: "tokens", refKey: `${pkg.key}:v${pkg.version}`, amountCents: pkg.priceCents, provider: "test", idemKey: `o_${p.id}`, status: "pending" } });
    await expect(confirmBankTransfer(f.id, order.id, { reference: "BANK-REF-1", amountCents: 1, reason: "Überweisung eingegangen" })).rejects.toMatchObject({ code: "amount" });
    await confirmBankTransfer(f.id, order.id, { reference: "BANK-REF-1", amountCents: pkg.priceCents, reason: "Überweisung eingegangen" });
    const pay = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(pay.method).toBe("bank_transfer");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("paid");
    expect((await db.communityProfile.findUniqueOrThrow({ where: { id: p.id } })).tokenBalance).toBe(pkg.tokens);
    await expect(confirmBankTransfer(f.id, order.id, { reference: "BANK-REF-2", amountCents: pkg.priceCents, reason: "Doppelt gebucht?" })).rejects.toMatchObject({ code: "state" });
    const support = await makeUser();
    await expect(confirmBankTransfer(support.id, order.id, { reference: "X-REF-1", amountCents: 1, reason: "nicht erlaubt" })).rejects.toMatchObject({ status: 403 });
  });
});
