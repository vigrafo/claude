import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { authenticator } from "otplib";
import { db } from "./db";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto";
import { audit } from "./audit";
import { AppError } from "./errors";

const MEMBER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 8;
export const REAUTH_MINUTES = 10;

export async function hashPassword(pw: string): Promise<string> {
  // argon2id, OWASP-Parameter
  return argonHash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try {
    return await argonVerify(hash, pw);
  } catch {
    return false;
  }
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 12) return "Das Passwort muss mindestens 12 Zeichen lang sein.";
  if (pw.length > 200) return "Das Passwort ist zu lang.";
  return null;
}

export async function createSession(userId: string, opts: { isAdmin?: boolean; userAgent?: string; ip?: string } = {}) {
  const token = randomToken(32);
  const expiresAt = opts.isAdmin
    ? new Date(Date.now() + ADMIN_SESSION_HOURS * 3600_000)
    : new Date(Date.now() + MEMBER_SESSION_DAYS * 86400_000);
  const firstProfile = await db.profileMembership.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  const session = await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      isAdmin: !!opts.isAdmin,
      expiresAt,
      activeProfileId: firstProfile?.profileId,
      userAgent: opts.userAgent?.slice(0, 200),
      ipHash: opts.ip ? sha256(`${process.env.SESSION_SECRET}:${opts.ip}`) : null,
    },
  });
  return { token, session };
}

export async function sessionFromToken(token: string | undefined | null) {
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.revokedAt || s.expiresAt.getTime() < Date.now()) return null;
  if (s.user.status === "banned" || s.user.status === "deleted") return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return s;
}

export async function revokeSession(token: string) {
  await db.session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, reason: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit("session.revoke_all", { targetType: "user", targetId: userId, meta: { reason } });
}

// ── MFA (TOTP) ──
authenticator.options = { window: 1 };

export function newMfaSecret(email: string) {
  const secret = authenticator.generateSecret();
  return { secret, otpauth: authenticator.keyuri(email, "eropub.com", secret) };
}

export function checkTotp(secret: string, code: string): boolean {
  return authenticator.check(code.replace(/\s/g, ""), secret);
}

export async function enableMfa(userId: string, secret: string, code: string) {
  if (!checkTotp(secret, code)) throw new AppError("mfa_invalid", "Der Code ist ungültig.");
  await db.user.update({ where: { id: userId }, data: { mfaSecretEnc: encrypt(secret), mfaEnabledAt: new Date() } });
  await audit("mfa.enabled", { actorUserId: userId, targetType: "user", targetId: userId });
}

export async function verifyUserTotp(userId: string, code: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u?.mfaSecretEnc) return false;
  return checkTotp(decrypt(u.mfaSecretEnc), code);
}

export async function createEmailToken(userId: string, purpose: "verify_email" | "reset_password", hours = 24) {
  const token = randomToken(24);
  await db.emailToken.create({
    data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + hours * 3600_000) },
  });
  return token;
}

export async function consumeEmailToken(token: string, purpose: string) {
  const t = await db.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.purpose !== purpose || t.usedAt || t.expiresAt.getTime() < Date.now()) return null;
  const upd = await db.emailToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return upd.count === 1 ? t : null;
}
