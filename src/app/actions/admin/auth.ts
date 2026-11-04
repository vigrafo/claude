"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { run, str, type ActionState } from "@/lib/actions";
import { ADMIN_COOKIE, clientIp, getAdmin } from "@/lib/viewer";
import { rateLimit } from "@/server/ratelimit";
import { AppError } from "@/server/errors";
import { ipAllowed } from "@/server/admin/guard";
import {
  adminLoginCheck, completeEnrolment, endAdminSession, reauthenticate, safeAdminNext, startAdminSession,
} from "@/server/admin/session";

const ENROL_COOKIE = "ep_admin_enrol";
const ADMIN_MAX_AGE = 8 * 3600;

async function guardIp() {
  const ip = await clientIp();
  if (!ipAllowed(ip)) throw new AppError("ip", "Zugriff von dieser IP-Adresse nicht erlaubt.", 403);
  return ip;
}

async function setAdminCookie(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true, sameSite: "strict", secure: process.env.APP_ENV === "production", path: "/", maxAge: ADMIN_MAX_AGE,
  });
}

async function begin(userId: string, ip: string) {
  const { token } = await startAdminSession(userId, { userAgent: (await headers()).get("user-agent") ?? undefined, ip });
  await setAdminCookie(token);
}

export async function adminLoginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ip = await guardIp();
    const email = str(fd, "email").toLowerCase();
    await rateLimit("admin_login", `${ip}:${email}`, 8, 900);
    const r = await adminLoginCheck(email, String(fd.get("password") ?? ""), str(fd, "otp"));
    if (r.status === "need_otp") return { ok: false, error: "Bitte gib den Code aus deiner Authenticator-App ein.", data: { step: "otp" } };
    if (r.status === "enrol") {
      (await cookies()).set(ENROL_COOKIE, r.enrolToken, { httpOnly: true, sameSite: "strict", secure: process.env.APP_ENV === "production", path: "/admin", maxAge: 600 });
      return { ok: true, data: { step: "enrol", secret: r.secret, otpauth: r.otpauth } };
    }
    await begin(r.userId, ip);
    redirect("/admin");
  });
}

export async function adminEnrolAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ip = await guardIp();
    await rateLimit("admin_enrol", ip, 10, 900);
    const c = await cookies();
    const userId = await completeEnrolment(c.get(ENROL_COOKIE)?.value, str(fd, "code"));
    c.delete(ENROL_COOKIE);
    await begin(userId, ip);
    redirect("/admin");
  });
}

export async function adminReauthAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ip = await guardIp();
    const a = await getAdmin();
    if (!a) redirect("/admin/login");
    await rateLimit("admin_reauth", `${ip}:${a.user.id}`, 8, 900);
    await reauthenticate(a.session.id, a.user.id, str(fd, "code"));
    redirect(safeAdminNext(str(fd, "next")));
  });
}

export async function adminLogoutAction(): Promise<void> {
  const a = await getAdmin();
  if (a) await endAdminSession(a.session.id, a.user.id);
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
