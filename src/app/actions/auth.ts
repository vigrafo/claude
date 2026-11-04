"use server";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { register } from "@/server/profiles";
import { consumeEmailToken, createEmailToken, createSession, hashPassword, revokeSession, validatePassword, verifyPassword, revokeAllSessions } from "@/server/auth";
import { rateLimit } from "@/server/ratelimit";
import { getSetting } from "@/server/settings";
import { sendMail } from "@/server/mail";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { bool, int, run, str, type ActionState } from "@/lib/actions";
import { SESSION_COOKIE, clearCookie, clientIp, setSessionCookie } from "@/lib/viewer";
import { cookies, headers } from "next/headers";

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const features = await getSetting("features");
    if (!features.registrationOpen) throw new AppError("closed", "Die Registrierung ist derzeit geschlossen.");
    const lim = await getSetting("ratelimits");
    await rateLimit("register", await clientIp(), lim.registrationsPerHourPerIp, 3600);
    const pw = str(fd, "password");
    if (pw !== str(fd, "password2")) throw new AppError("pw", "Die Passwörter stimmen nicht überein.");
    const { user } = await register({
      email: str(fd, "email"), password: pw, handle: str(fd, "handle"),
      profileType: str(fd, "profileType") === "couple" ? "couple" : "single",
      birthYear: int(fd, "birthYear"), adultConfirmed: bool(fd, "adult"), acceptTerms: bool(fd, "terms"), acceptPrivacy: bool(fd, "privacy"),
      country: str(fd, "country"),
    });
    const { token } = await createSession(user.id, { userAgent: (await headers()).get("user-agent") ?? undefined, ip: await clientIp() });
    await setSessionCookie(SESSION_COOKIE, token, 30 * 86400);
    redirect("/anmelden/bestaetigen?neu=1");
  });
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const email = str(fd, "email").toLowerCase();
    await rateLimit("login", `${await clientIp()}:${email}`, 10, 900);
    const user = await db.user.findUnique({ where: { email } });
    // Gleiche Antwort für unbekannte Adresse und falsches Passwort
    const ok = user ? await verifyPassword(user.passwordHash, str(fd, "password")) : await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "x");
    if (!user || !ok) throw new AppError("login", "E-Mail-Adresse oder Passwort ist falsch.");
    if (user.status !== "active") throw new AppError("login", "Dieses Konto ist gesperrt. Bitte wende dich an den Support.");
    if (user.mfaEnabledAt) {
      const { verifyUserTotp } = await import("@/server/auth");
      if (!str(fd, "otp")) return { ok: false, error: "Bitte gib zusätzlich deinen Code aus der Authenticator-App ein.", data: { needOtp: true } };
      if (!(await verifyUserTotp(user.id, str(fd, "otp")))) throw new AppError("otp", "Der Code ist ungültig.");
    }
    const { token } = await createSession(user.id, { userAgent: (await headers()).get("user-agent") ?? undefined, ip: await clientIp() });
    await setSessionCookie(SESSION_COOKIE, token, 30 * 86400);
    await audit("auth.login", { actorUserId: user.id });
    redirect(user.emailVerifiedAt ? "/app" : "/anmelden/bestaetigen");
  });
}

export async function logoutAction() {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (t) await revokeSession(t);
  await clearCookie(SESSION_COOKIE);
  redirect("/");
}

export async function resendVerificationAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const { getViewer } = await import("@/lib/viewer");
    const v = await getViewer();
    if (!v) throw new AppError("auth", "Bitte melde dich an.");
    await rateLimit("resend", v.user.id, 3, 3600);
    const token = await createEmailToken(v.user.id, "verify_email", 48);
    await sendMail("verify_email", v.user.email, { link: `${process.env.APP_URL}/anmelden/bestaetigen?token=${token}` });
    return { ok: true, message: "Wir haben dir eine neue Bestätigungs-E-Mail gesendet." };
  });
}

export async function confirmEmail(token: string): Promise<boolean> {
  const t = await consumeEmailToken(token, "verify_email");
  if (!t) return false;
  await db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
  await audit("auth.email_verified", { actorUserId: t.userId });
  return true;
}

export async function requestResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const email = str(fd, "email").toLowerCase();
    await rateLimit("reset", `${await clientIp()}:${email}`, 3, 3600);
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.status === "active") {
      const token = await createEmailToken(user.id, "reset_password", 1);
      await sendMail("reset_password", email, { link: `${process.env.APP_URL}/passwort?token=${token}` });
    }
    return { ok: true, message: "Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link gesendet." };
  });
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const pw = str(fd, "password");
    const err = validatePassword(pw);
    if (err) throw new AppError("pw", err);
    if (pw !== str(fd, "password2")) throw new AppError("pw", "Die Passwörter stimmen nicht überein.");
    const t = await consumeEmailToken(str(fd, "token"), "reset_password");
    if (!t) throw new AppError("token", "Der Link ist ungültig oder abgelaufen.");
    await db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(pw) } });
    await revokeAllSessions(t.userId, "password_reset");
    return { ok: true, message: "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden." };
  });
}
