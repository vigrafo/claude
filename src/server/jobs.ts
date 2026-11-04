import { db } from "./db";
import { processOutboxBatch, type Handler } from "./outbox";
import { expireVerifications, purgeEvidence } from "./verification";
import { revokeRoom, expireRinging } from "./calls";
import { storage } from "./storage";
import { sendMail } from "./mail";
import { getSetting } from "./settings";
import { sha256 } from "./crypto";
import { audit } from "./audit";
import { cleanupRateLimits } from "./ratelimit";
import { releaseExpired } from "./events";
import { addMonthsUtc, firstRegularChargeDate, priceNoticeDue, formatEuro } from "@/domain/plans";

/** Outbox-Handler. Benachrichtigungen sind neutral formuliert und enthalten keine Inhalte. */
export const handlers: Record<string, Handler> = {
  "message.created": async (p) => {
    const toProfileId = String(p.toProfileId);
    const members = await db.profileMembership.findMany({ where: { profileId: toProfileId, status: "active" } });
    for (const m of members) {
      await db.notification.create({ data: { userId: m.userId, kind: "message", title: "Du hast eine neue Nachricht", link: `/app/nachrichten/${p.conversationId}` } });
    }
  },
  "notify.user": async (p) => {
    await db.notification.create({ data: { userId: String(p.userId), kind: String(p.kind ?? "info"), title: String(p.title), link: p.link ? String(p.link) : null } });
  },
  "admin.notify": async (p) => {
    const addr = await getSetting("contact.addresses");
    const count = await db.moderationCase.count();
    await sendMail("admin_case", addr.admin, {
      number: `V-${String(count + 1).padStart(6, "0")}`, summary: String(p.summary ?? "Neuer Vorgang"), link: `${process.env.APP_URL}${p.link ?? "/admin"}`,
    });
  },
  "call.revoke": async (p) => {
    await revokeRoom(String(p.roomName));
  },
};

/**
 * Löschlauf: personenbezogene Daten entfernen/pseudonymisieren; Finanz- und Missbrauchsdaten mit
 * gesetzlicher Aufbewahrung bleiben getrennt erhalten (Orders/Invoices/Refunds; Reports anonymisiert).
 * Ein Tombstone stellt sicher, dass Löschungen nach einem Backup-Restore erneut angewendet werden.
 */
export async function runDeletions(now = new Date()) {
  const due = await db.deletionRequest.findMany({ where: { status: { in: ["requested", "scheduled"] }, scheduledFor: { lte: now } } });
  for (const d of due) {
    try {
      await deleteUserData(d.userId);
      await db.deletionRequest.update({ where: { id: d.id }, data: { status: "done", doneAt: new Date() } });
    } catch (e) {
      await db.deletionRequest.update({ where: { id: d.id }, data: { status: "failed", error: String((e as Error).message).slice(0, 300) } });
    }
  }
  return due.length;
}

export async function deleteUserData(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const subjectHash = sha256(`user:${userId}`);
  const mediaKeys: string[] = [];
  await db.$transaction(async (tx) => {
    const memberships = await tx.profileMembership.findMany({ where: { userId } });
    for (const m of memberships) {
      const others = await tx.profileMembership.count({ where: { profileId: m.profileId, status: "active", userId: { not: userId } } });
      if (others === 0) {
        await tx.message.updateMany({ where: { senderProfileId: m.profileId }, data: { body: "[gelöscht]", deletedAt: new Date() } });
        const assets = await tx.mediaAsset.findMany({ where: { ownerId: m.profileId, legalHold: false, deletedAt: null }, select: { storageKey: true } });
        mediaKeys.push(...assets.map((a) => a.storageKey));
        await tx.mediaAsset.updateMany({ where: { ownerId: m.profileId, legalHold: false }, data: { deletedAt: new Date() } });
        await tx.communityProfile.update({
          where: { id: m.profileId },
          data: { status: "deleted", handle: `geloescht_${m.profileId.slice(-8)}`, headline: null, about: null, lat: null, lng: null, postalPrefix: null, regionCity: null, lookingFor: [] },
        });
        await tx.profileInterest.deleteMany({ where: { profileId: m.profileId } });
      }
    }
    await tx.message.updateMany({ where: { senderUserId: userId }, data: { body: "[gelöscht]", deletedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.emailToken.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: { email: `deleted+${userId}@invalid.local`, passwordHash: "!", mfaSecretEnc: null, status: "deleted", deletedAt: new Date() },
    });
    await tx.deletionTombstone.upsert({ where: { subjectHash }, create: { subjectHash, doneAt: new Date() }, update: {} });
  });
  // Dateien erst nach erfolgreicher Transaktion entfernen (rechtlich gesicherte bleiben erhalten)
  for (const k of mediaKeys) await storage().del(k).catch(() => undefined);
  await audit("privacy.deleted", { targetType: "user", targetId: userId, meta: { mediaDeleted: mediaKeys.length } });
}

/** Nach einem Restore: alle Tombstones erneut anwenden (Restore darf Löschungen nicht dauerhaft rückgängig machen). */
export async function reapplyDeletions() {
  const users = await db.user.findMany({ where: { status: { not: "deleted" } }, select: { id: true } });
  const tomb = new Set((await db.deletionTombstone.findMany({ select: { subjectHash: true } })).map((t) => t.subjectHash));
  let n = 0;
  for (const u of users) {
    if (tomb.has(sha256(`user:${u.id}`))) {
      await deleteUserData(u.id);
      n++;
    }
  }
  return n;
}

/** Preiserhöhungs-Hinweis (Premium nach 24 Monaten) – einmalig, rechtzeitig. */
export async function sendPriceNotices(now = new Date()) {
  const subs = await db.subscription.findMany({ where: { plan: "premium", status: "active", priceChangeNoticeAt: null } });
  let n = 0;
  for (const s of subs) {
    const clock = await db.premiumClock.findUnique({ where: { userId: s.userId } });
    if (!clock || !s.currentPeriodStart) continue;
    const first = firstRegularChargeDate(s.currentPeriodStart, clock.introPriceEndsAt);
    if (!priceNoticeDue(now, first)) continue;
    const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "Europe/Berlin" }).format(first);
    await db.notification.create({
      data: { userId: s.userId, kind: "billing", title: `Dein Premium-Preis ändert sich ab ${date} auf ${formatEuro(1400)} pro Monat`, link: "/app/konto" },
    });
    await db.subscription.update({ where: { id: s.id }, data: { priceChangeNoticeAt: now } });
    n++;
  }
  return n;
}

/** Abgelaufene Abos ohne Verlängerung schließen; Rechte enden über Entitlement.validTo automatisch. */
export async function closeEndedSubscriptions(now = new Date()) {
  const r = await db.subscription.updateMany({
    where: { status: "cancel_at_period_end", currentPeriodEnd: { lte: now } },
    data: { status: "expired" },
  });
  return r.count;
}

export async function expireGames(now = new Date()) {
  const r = await db.gameSession.updateMany({ where: { status: { in: ["invited", "accepted", "answering"] }, expiresAt: { lte: now } }, data: { status: "expired" } });
  return r.count;
}

/** Nicht angenommene Anrufe (60 s) als verpasst markieren und Räume schließen. */
export async function missedCalls(now = new Date()) {
  return expireRinging(now);
}

/** Gold-CMS: geplante Inhalte zum Veröffentlichungszeitpunkt freischalten. */
export async function publishScheduledContent(now = new Date()) {
  const r = await db.goldContent.updateMany({ where: { status: "scheduled", publishAt: { lte: now } }, data: { status: "published" } });
  return r.count;
}

export async function runPeriodic() {
  const results = {
    deletions: await runDeletions(),
    verificationsExpired: await expireVerifications(),
    evidencePurged: await purgeEvidence(),
    priceNotices: await sendPriceNotices(),
    subscriptionsClosed: await closeEndedSubscriptions(),
    gamesExpired: await expireGames(),
    missedCalls: await missedCalls(),
    contentPublished: await publishScheduledContent(),
    ticketsReleased: await db.$transaction((tx) => releaseExpired(tx)),
  };
  await cleanupRateLimits();
  return results;
}

export { processOutboxBatch, addMonthsUtc };
