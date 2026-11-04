import { db } from "./db";
import { AppError } from "./errors";
import { sha256 } from "./crypto";

/**
 * Fenster-Ratelimit. Speicher: PostgreSQL (funktioniert ohne Zusatzdienst); bei REDIS_URL kann
 * später ein Redis-Backend ergänzt werden. Schlüssel werden gehasht (keine Klartext-IPs).
 */
export async function rateLimit(scope: string, subject: string, limit: number, windowSec: number) {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);
  const key = `${scope}:${sha256(subject).slice(0, 32)}`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" (key, "windowStart", count) VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, "windowStart") DO UPDATE SET count = "RateLimitHit".count + 1
    RETURNING count`;
  if (rows[0].count > limit) throw new AppError("rate_limited", "Zu viele Anfragen. Bitte versuche es später erneut.", 429);
}

export async function cleanupRateLimits() {
  await db.rateLimitHit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86400_000) } } });
}
