"use server";
import { db } from "@/server/db";
import { rateLimit } from "@/server/ratelimit";
import { getSetting } from "@/server/settings";
import { sendMail } from "@/server/mail";
import { AppError } from "@/server/errors";
import { run, str, type ActionState } from "@/lib/actions";
import { clientIp, getViewer } from "@/lib/viewer";

export async function contactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    if (str(fd, "website")) return { ok: true, message: "Danke für deine Nachricht." }; // Honeypot
    const lim = await getSetting("ratelimits");
    await rateLimit("contact", await clientIp(), lim.contactFormPerHourPerIp, 3600);
    const v = await getViewer();
    const email = v?.user.email ?? str(fd, "email");
    const body = str(fd, "body");
    if (!v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("email", "Bitte gib eine gültige E-Mail-Adresse an.");
    if (body.length < 10 || body.length > 5000) throw new AppError("body", "Bitte schreibe 10 bis 5000 Zeichen.");
    const count = await db.supportTicket.count();
    const t = await db.supportTicket.create({
      data: { number: `S-${String(count + 1).padStart(6, "0")}`, requesterId: v?.user.id, email: v ? null : email, topic: str(fd, "topic") || "allgemein", body },
    });
    const addr = await getSetting("contact.addresses");
    // Admin-Mail: nur Fallnummer + neutraler Link, keine Inhalte
    await sendMail("contact_form", addr.contact, { number: t.number, link: `${process.env.APP_URL}/admin/support/${t.id}` }).catch(() => undefined);
    return { ok: true, message: `Danke! Deine Anfrage ${t.number} ist eingegangen.` };
  });
}
