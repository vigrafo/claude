"use server";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingUser } from "@/app/app/_lib/server";
import { enableMfa, hashPassword, newMfaSecret, validatePassword, verifyPassword } from "@/server/auth";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { rateLimit } from "@/server/ratelimit";

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, v } = await actingUser();
    await rateLimit("pwchange", userId, 5, 3600);
    if (!(await verifyPassword(v.user.passwordHash, str(fd, "current")))) throw new AppError("pw", "Dein aktuelles Passwort ist nicht korrekt.");
    const pw = str(fd, "password");
    const err = validatePassword(pw);
    if (err) throw new AppError("pw", err);
    if (pw !== str(fd, "password2")) throw new AppError("pw", "Die Passwörter stimmen nicht überein.");
    await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw) } });
    // andere Sitzungen beenden, aktuelle bleibt
    await db.session.updateMany({ where: { userId, revokedAt: null, id: { not: v.session.id } }, data: { revokedAt: new Date() } });
    await audit("auth.password_changed", { actorUserId: userId, targetType: "user", targetId: userId });
    revalidatePath("/app/profil/sicherheit");
    return { ok: true, message: "Passwort geändert. Andere Geräte wurden abgemeldet." };
  });
}

export async function startMfaAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const { v } = await actingUser();
    if (v.user.mfaEnabledAt) throw new AppError("mfa", "Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
    const { secret, otpauth } = newMfaSecret(v.user.email);
    return { ok: true, data: { secret, otpauth } };
  });
}

export async function confirmMfaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, v } = await actingUser();
    if (v.user.mfaEnabledAt) throw new AppError("mfa", "Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
    await rateLimit("mfa_enable", userId, 10, 900);
    await enableMfa(userId, str(fd, "secret"), str(fd, "code"));
    revalidatePath("/app/profil/sicherheit");
    return { ok: true, message: "Zwei-Faktor-Anmeldung ist aktiv. Beim nächsten Login fragen wir nach dem Code." };
  });
}

export async function revokeSessionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, v } = await actingUser();
    const id = str(fd, "sessionId");
    if (id === v.session.id) throw new AppError("current", "Die aktuelle Sitzung beendest du über „Abmelden“.");
    const r = await db.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) throw new AppError("not_found", "Sitzung nicht gefunden.");
    await audit("session.revoked", { actorUserId: userId, targetType: "session", targetId: id });
    revalidatePath("/app/profil/sicherheit");
    return { ok: true, message: "Sitzung beendet." };
  });
}
