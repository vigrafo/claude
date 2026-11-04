import { db } from "../db";
import { audit } from "../audit";
import { AppError, notFound } from "../errors";
import { adminAdjustTokens, FOUR_EYES_TOKEN_THRESHOLD } from "../tokens";
import { randomToken } from "../crypto";
import { assertPerm, requireReason } from "./guard";
import { createApproval } from "./approvals";

/** Tokenpakete versioniert: neue Version statt Änderung; Deaktivieren stoppt Neuverkäufe. */
export async function createPackageVersion(actorUserId: string, input: { key: string; tokens: number; priceCents: number; currency?: string }) {
  await assertPerm(actorUserId, "tokens.manage");
  const key = input.key.trim();
  if (!/^[a-z0-9_]{2,20}$/.test(key)) throw new AppError("key", "Schlüssel: 2–20 Zeichen a–z, 0–9, _.");
  if (!Number.isInteger(input.tokens) || input.tokens < 1 || input.tokens > 10_000) throw new AppError("tokens", "Tokens: 1–10000.");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 50 || input.priceCents > 100_000) throw new AppError("price", "Preis in Cent: 50–100000.");
  const currency = (input.currency ?? "EUR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError("currency", "Währung als ISO-Code (z. B. EUR).");
  const last = await db.tokenPackageVersion.findFirst({ where: { key }, orderBy: { version: "desc" } });
  const row = await db.tokenPackageVersion.create({ data: { key, version: (last?.version ?? 0) + 1, tokens: input.tokens, priceCents: input.priceCents, currency } });
  await audit("tokens.package_version_created", { actorUserId, targetType: "token_package", targetId: row.id, meta: { key, version: row.version, tokens: row.tokens, priceCents: row.priceCents } });
  return row;
}

export async function setPackageActive(actorUserId: string, id: string, active: boolean) {
  await assertPerm(actorUserId, "tokens.manage");
  const p = await db.tokenPackageVersion.findUnique({ where: { id } });
  if (!p) throw notFound();
  await db.tokenPackageVersion.update({ where: { id }, data: { active } });
  await audit(active ? "tokens.package_activated" : "tokens.package_deactivated", { actorUserId, targetType: "token_package", targetId: id, meta: { key: p.key, version: p.version } });
}

/**
 * Admin-Korrektur über adminAdjustTokens. Über der Schwelle entsteht ein Vier-Augen-Antrag,
 * den eine ZWEITE Person mit tokens.manage freigibt.
 */
export async function requestTokenAdjust(actorUserId: string, handle: string, delta: number, reasonRaw: string) {
  await assertPerm(actorUserId, "tokens.manage");
  const reason = requireReason(reasonRaw);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new AppError("delta", "Ganzzahlige Änderung ≠ 0 angeben.");
  const profile = await db.communityProfile.findUnique({ where: { handle: handle.trim() } });
  if (!profile) throw notFound("Profil nicht gefunden.");
  const own = await db.profileMembership.findFirst({ where: { profileId: profile.id, userId: actorUserId } });
  if (own) throw new AppError("own_profile", "Korrekturen am eigenen Profil sind nicht erlaubt.", 403);
  if (Math.abs(delta) > FOUR_EYES_TOKEN_THRESHOLD) {
    const p = await createApproval("token_correction", { profileId: profile.id, delta, reason }, actorUserId);
    return { status: "pending" as const, approvalId: p.id };
  }
  await adminAdjustTokens({ profileId: profile.id, delta, reason, actorUserId, idemKey: `admin:${randomToken(12)}` });
  return { status: "done" as const };
}
