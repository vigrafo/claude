import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { livekitConfigured } from "../calls";
import { IDENTITY_PROVIDERS } from "../verification";
import { assertPerm } from "./guard";

/** Echte Kennzahlen aus der Datenbank – keine Demo-Werte. */
export async function dashboardKpis(now = new Date()) {
  const d1 = new Date(now.getTime() - 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const [
    members, verifiedProfiles, pendingVerifications, pendingGroups, pendingEvents, pendingOrganizers, pendingClubs,
    openCases, openTickets, outboxPending, outboxFailed, webhookFailures, subsByPlan, revenue,
  ] = await Promise.all([
    db.user.count({ where: { status: { not: "deleted" } } }),
    db.communityProfile.count({ where: { verifiedBadge: true, status: "active" } }),
    db.verificationCase.count({ where: { status: "pending_review" } }),
    db.group.count({ where: { status: "pending_approval" } }),
    db.event.count({ where: { status: "pending_approval" } }),
    db.organizer.count({ where: { status: "pending" } }),
    db.club.count({ where: { status: "pending" } }),
    db.moderationCase.count({ where: { status: { in: ["open", "in_review", "appealed"] } } }),
    db.supportTicket.count({ where: { status: { in: ["open", "pending"] } } }),
    db.outboxEvent.count({ where: { status: "pending" } }),
    db.outboxEvent.count({ where: { status: "failed" } }),
    db.webhookEvent.count({ where: { status: { in: ["rejected", "failed"] }, receivedAt: { gte: d1 } } }),
    db.subscription.groupBy({ by: ["plan"], where: { status: { in: ["active", "past_due", "cancel_at_period_end"] } }, _count: { _all: true } }),
    db.order.groupBy({ by: ["currency"], where: { status: { in: ["paid", "partially_refunded"] }, paidAt: { gte: d30 } }, _sum: { amountCents: true } }),
  ]);
  return {
    members, verifiedProfiles, pendingVerifications, pendingGroups, pendingEvents, pendingOrganizers, pendingClubs,
    openCases, openTickets, outboxPending, outboxFailed, webhookFailures,
    subsByPlan: subsByPlan.map((s) => ({ plan: s.plan, count: s._count._all })),
    revenue30d: revenue.map((r) => ({ currency: r.currency, cents: r._sum.amountCents ?? 0 })),
  };
}

export async function dbPing(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: (e as Error).message.slice(0, 120) };
  }
}

export async function integrationHealth() {
  const providers = await db.providerConfiguration.findMany({ select: { key: true, enabled: true, mode: true, webhookHealthy: true, webhookLastAt: true } });
  return {
    db: await dbPing(),
    livekit: livekitConfigured(),
    smtpMode: process.env.SMTP_HOST && process.env.MAIL_MODE === "smtp" ? "smtp" : "log (kein Versand)",
    providersEnabled: providers.filter((p) => p.enabled).map((p) => `${p.key} (${p.mode})`),
    identityProvider: IDENTITY_PROVIDERS.filter((p) => p.isAvailable()).map((p) => p.displayName),
    storage: !!process.env.S3_ENDPOINT || !!process.env.S3_BUCKET,
  };
}

export function releaseInfo() {
  let version = "unbekannt";
  try {
    version = (JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string }).version ?? version;
  } catch {
    /* ignore */
  }
  return { version, commit: process.env.APP_RELEASE || null, env: process.env.APP_ENV ?? "unbekannt" };
}

export function backupStatus(): { configured: boolean; lastOk: string | null } {
  const v = process.env.BACKUP_LAST_OK?.trim();
  return v ? { configured: true, lastOk: v } : { configured: false, lastOk: null };
}

/** Fehlgeschlagenes Outbox-Ereignis erneut einplanen (kein Shell-Zugriff, nur Statuswechsel). */
export async function retryOutbox(actorUserId: string, id: string) {
  await assertPerm(actorUserId, "ops.view");
  const e = await db.outboxEvent.findUnique({ where: { id } });
  if (!e) throw notFound();
  if (e.status !== "failed") throw new AppError("state", "Nur fehlgeschlagene Ereignisse können erneut eingeplant werden.");
  await db.outboxEvent.update({ where: { id }, data: { status: "pending", availableAt: new Date(), attempts: 0 } });
  await audit("ops.outbox_retry", { actorUserId, targetType: "outbox", targetId: id, meta: { topic: e.topic } });
}
