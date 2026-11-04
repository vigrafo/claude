"use server";
import { bool, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { sendMail, TEMPLATES } from "@/server/mail";
import { audit } from "@/server/audit";
import { sha256 } from "@/server/crypto";

/** Testversand nur bei echtem SMTP-Betrieb (MAIL_MODE=smtp) und ausdrücklicher Bestätigung. */
export async function sendTestMailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("notifications.manage", async (a) => {
    if (!(process.env.MAIL_MODE === "smtp" && process.env.SMTP_HOST)) throw new AppError("mail_mode", "Testversand ist nur mit MAIL_MODE=smtp und konfiguriertem SMTP möglich.");
    if (!bool(fd, "confirm")) throw new AppError("confirm", "Bitte den Testversand ausdrücklich bestätigen.");
    const tpl = str(fd, "template");
    if (!TEMPLATES[tpl]) throw new AppError("template", "Unbekannte Vorlage.");
    const to = str(fd, "to").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new AppError("to", "Bitte eine gültige Adresse angeben.");
    const base = process.env.APP_URL ?? "https://eropub.com";
    await sendMail(tpl, to, { link: `${base}/`, number: "TEST-0001", summary: "Testnachricht" });
    await audit("mail.test_sent", { actorUserId: a.user.id, targetType: "template", targetId: tpl, meta: { toHash: sha256(to) } });
    return { ok: true, message: "Testnachricht versendet." };
  });
}
