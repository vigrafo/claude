import { db } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { checkTotp, createSession, enableMfa, newMfaSecret, verifyPassword, verifyUserTotp } from "../auth";
import { decrypt, encrypt } from "../crypto";
import { hasPermission } from "../rbac";

/** Dummy-Hash, damit unbekannte Adressen gleich lange dauern wie falsche Passwörter. */
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ENROL_MINUTES = 10;
const GENERIC = "E-Mail-Adresse, Passwort oder Code ist falsch.";

export type AdminLoginResult =
  | { status: "ok"; userId: string }
  | { status: "need_otp" }
  | { status: "enrol"; userId: string; secret: string; otpauth: string; enrolToken: string };

/**
 * Admin-Anmeldung: E-Mail + Passwort + Pflicht-TOTP. Personen mit Adminrecht ohne MFA
 * müssen zuerst MFA einrichten (Secret + otpauth-URI, Bestätigung per Code), bevor eine Adminsitzung entsteht.
 */
export async function adminLoginCheck(emailRaw: string, password: string, otp: string): Promise<AdminLoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const pwOk = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !pwOk) {
    await audit("admin.login_failed", { targetType: "user", targetId: user?.id, meta: { step: "password" } });
    throw new AppError("login", GENERIC);
  }
  if (user.status !== "active") throw new AppError("login", "Dieses Konto ist gesperrt.");
  if (!(await hasPermission(user.id, "admin.access"))) {
    await audit("admin.login_failed", { targetType: "user", targetId: user.id, meta: { step: "no_admin_access" } });
    throw new AppError("login", GENERIC);
  }
  if (!user.mfaEnabledAt || !user.mfaSecretEnc) {
    const { secret, otpauth } = newMfaSecret(user.email);
    return { status: "enrol", userId: user.id, secret, otpauth, enrolToken: makeEnrolToken(user.id, secret) };
  }
  if (!otp.trim()) return { status: "need_otp" };
  if (!(await verifyUserTotp(user.id, otp))) {
    await audit("admin.login_failed", { targetType: "user", targetId: user.id, meta: { step: "totp" } });
    throw new AppError("login", GENERIC);
  }
  return { status: "ok", userId: user.id };
}

export function makeEnrolToken(userId: string, secret: string, now = Date.now()): string {
  return encrypt(JSON.stringify({ u: userId, s: secret, exp: now + ENROL_MINUTES * 60_000 }));
}

export function readEnrolToken(token: string | undefined | null): { userId: string; secret: string } | null {
  if (!token) return null;
  try {
    const v = JSON.parse(decrypt(token)) as { u: string; s: string; exp: number };
    if (!v.u || !v.s || v.exp < Date.now()) return null;
    return { userId: v.u, secret: v.s };
  } catch {
    return null;
  }
}

/** Abschluss der MFA-Einrichtung: Code prüfen, Secret verschlüsselt speichern. */
export async function completeEnrolment(enrolToken: string | undefined, code: string): Promise<string> {
  const e = readEnrolToken(enrolToken);
  if (!e) throw new AppError("enrol_expired", "Die Einrichtung ist abgelaufen. Bitte melde dich erneut an.");
  if (!(await hasPermission(e.userId, "admin.access"))) throw new AppError("login", GENERIC);
  if (!checkTotp(e.secret, code)) throw new AppError("mfa_invalid", "Der Code ist ungültig.");
  await enableMfa(e.userId, e.secret, code);
  return e.userId;
}

/** Adminsitzung (8 h) mit gesetztem mfaAt. Login gilt zugleich als frische Re-Authentifizierung. */
export async function startAdminSession(userId: string, meta: { userAgent?: string; ip?: string } = {}) {
  const { token, session } = await createSession(userId, { isAdmin: true, userAgent: meta.userAgent, ip: meta.ip });
  const now = new Date();
  await db.session.update({ where: { id: session.id }, data: { mfaAt: now, reauthAt: now, activeProfileId: null } });
  await audit("admin.login", { actorUserId: userId, targetType: "session", targetId: session.id });
  return { token, expiresAt: session.expiresAt };
}

export async function reauthenticate(sessionId: string, userId: string, code: string) {
  if (!(await verifyUserTotp(userId, code))) {
    await audit("admin.reauth_failed", { actorUserId: userId, targetType: "session", targetId: sessionId });
    throw new AppError("mfa_invalid", "Der Code ist ungültig.");
  }
  await db.session.update({ where: { id: sessionId }, data: { reauthAt: new Date() } });
  await audit("admin.reauth", { actorUserId: userId, targetType: "session", targetId: sessionId });
}

export async function endAdminSession(sessionId: string, userId: string) {
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await audit("admin.logout", { actorUserId: userId, targetType: "session", targetId: sessionId });
}

/** Rücksprungziel nur innerhalb des Admin-Backends (kein Open Redirect). */
export function safeAdminNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\")) return "/admin";
  return next;
}
