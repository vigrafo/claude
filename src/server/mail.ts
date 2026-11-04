import nodemailer from "nodemailer";
import { db } from "./db";
import { sha256 } from "./crypto";

/**
 * Mailadapter (SMTP). Ohne SMTP_HOST oder mit MAIL_MODE=log werden KEINE echten E-Mails versendet –
 * Inhalte gehen dann nur ins Dev-Log (ohne Empfängeradresse in Klartext im Audit).
 * Vorlagen sind neutral: keine Nachrichtentexte, keine intimen Inhalte, keine Ausweisdaten.
 */
export const TEMPLATES: Record<string, { subject: string; text: (v: Record<string, string>) => string }> = {
  verify_email: {
    subject: "Bitte bestätige deine E-Mail-Adresse",
    text: (v) => `Hallo,\n\nbitte bestätige deine E-Mail-Adresse für dein Konto:\n${v.link}\n\nFalls du dich nicht registriert hast, ignoriere diese E-Mail.\n`,
  },
  reset_password: {
    subject: "Passwort zurücksetzen",
    text: (v) => `Hallo,\n\nüber diesen Link kannst du ein neues Passwort setzen (1 Stunde gültig):\n${v.link}\n`,
  },
  couple_invite: {
    subject: "Einladung zu einem gemeinsamen Profil",
    text: (v) => `Hallo,\n\ndu wurdest eingeladen, einem gemeinsamen Profil beizutreten. Du benötigst dafür ein eigenes Konto:\n${v.link}\n`,
  },
  notification: {
    subject: "Neue Aktivität in deinem Konto",
    text: (v) => `Hallo,\n\nes gibt eine neue Aktivität in deinem Konto. Melde dich an, um sie zu sehen:\n${v.link}\n`,
  },
  admin_case: {
    subject: "Neuer Vorgang zur Bearbeitung",
    text: (v) => `Fall ${v.number}: ${v.summary}\nBearbeitung im geschützten Backend: ${v.link}\n`,
  },
  contact_form: {
    subject: "Kontaktanfrage",
    text: (v) => `Ticket ${v.number} wurde eröffnet. Bearbeitung im Backend: ${v.link}\n`,
  },
};

export const devOutbox: { to: string; subject: string; text: string }[] = [];

export async function sendMail(template: keyof typeof TEMPLATES | string, to: string, vars: Record<string, string>) {
  const t = TEMPLATES[template];
  if (!t) throw new Error(`Unbekannte Vorlage ${template}`);
  const text = t.text(vars);
  const from = process.env.MAIL_FROM ?? "eropub.com <info@eropub.com>";
  const live = process.env.SMTP_HOST && process.env.MAIL_MODE === "smtp";
  try {
    if (live) {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({ from, to, subject: t.subject, text });
    } else {
      devOutbox.push({ to, subject: t.subject, text });
      if (devOutbox.length > 100) devOutbox.shift();
      if (process.env.APP_ENV === "development") console.info(`[mail:log] ${template} → ${to}\n${text}`);
    }
    await db.emailLog.create({ data: { template, toHash: sha256(to.toLowerCase()), status: live ? "sent" : "suppressed" } }).catch(() => undefined);
  } catch (e) {
    await db.emailLog.create({ data: { template, toHash: sha256(to.toLowerCase()), status: "failed", error: String((e as Error).message).slice(0, 300) } }).catch(() => undefined);
    throw e;
  }
}
