import { db, type Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";

/**
 * Unveränderliches Token-Ledger je Community-Profil (Tokens gehören zum gemeinsamen Profil).
 * Der Kontostand-Cache wird in derselben Transaktion unter Zeilensperre fortgeschrieben.
 * Jede Buchung hat einen eindeutigen idemKey → keine Doppelbuchung bei Wiederholungen.
 */
export async function lockProfileBalance(tx: Tx, profileId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ tokenBalance: number }[]>`
    SELECT "tokenBalance" FROM "CommunityProfile" WHERE id = ${profileId} FOR UPDATE`;
  if (!rows.length) throw new AppError("not_found", "Profil nicht gefunden.", 404);
  return rows[0].tokenBalance;
}

export interface LedgerInput {
  profileId: string;
  delta: number;
  kind: string;
  idemKey: string;
  refType?: string;
  refId?: string;
  actorUserId?: string;
  reason?: string;
}

/** Bucht innerhalb einer bestehenden Transaktion. Liefert existierende Buchung bei gleichem idemKey. */
export async function postLedger(tx: Tx, input: LedgerInput) {
  const existing = await tx.tokenLedgerEntry.findUnique({ where: { idemKey: input.idemKey } });
  if (existing) return { entry: existing, duplicate: true };
  const balance = await lockProfileBalance(tx, input.profileId);
  // Nach Erhalt der Sperre erneut prüfen (paralleler Request mit gleichem Schlüssel)
  const again = await tx.tokenLedgerEntry.findUnique({ where: { idemKey: input.idemKey } });
  if (again) return { entry: again, duplicate: true };
  const next = balance + input.delta;
  if (next < 0) throw new AppError("insufficient_tokens", "Nicht genügend Tokens.", 402);
  const entry = await tx.tokenLedgerEntry.create({
    data: {
      profileId: input.profileId, delta: input.delta, balanceAfter: next, kind: input.kind, idemKey: input.idemKey,
      refType: input.refType, refId: input.refId, actorUserId: input.actorUserId, reason: input.reason,
    },
  });
  await tx.communityProfile.update({ where: { id: input.profileId }, data: { tokenBalance: next } });
  return { entry, duplicate: false };
}

/** Kontostand aus dem Ledger (Wahrheit) – für Abgleich/Monitoring. */
export async function ledgerBalance(profileId: string): Promise<number> {
  const r = await db.tokenLedgerEntry.aggregate({ where: { profileId }, _sum: { delta: true } });
  return r._sum.delta ?? 0;
}

/** Autorisierte, begründete Admin-Korrektur. Größere Korrekturen (>100) benötigen Vier-Augen-Freigabe. */
export const FOUR_EYES_TOKEN_THRESHOLD = 100;

export async function adminAdjustTokens(opts: {
  profileId: string; delta: number; reason: string; actorUserId: string; approvedBy?: string; idemKey: string;
}) {
  if (!opts.reason || opts.reason.trim().length < 5) throw new AppError("reason_required", "Bitte eine Begründung angeben.");
  if (Math.abs(opts.delta) > FOUR_EYES_TOKEN_THRESHOLD && (!opts.approvedBy || opts.approvedBy === opts.actorUserId)) {
    throw new AppError("four_eyes", "Diese Korrektur benötigt die Freigabe einer zweiten berechtigten Person.", 403);
  }
  return db.$transaction(async (tx) => {
    const r = await postLedger(tx, {
      profileId: opts.profileId, delta: opts.delta, kind: opts.delta >= 0 ? "admin_credit" : "admin_debit",
      idemKey: opts.idemKey, actorUserId: opts.actorUserId, reason: opts.reason, refType: "admin",
    });
    await audit("tokens.admin_adjust", {
      actorUserId: opts.actorUserId, targetType: "profile", targetId: opts.profileId,
      meta: { delta: opts.delta, reason: opts.reason, approvedBy: opts.approvedBy ?? null },
    }, tx);
    return r;
  });
}

/**
 * Chargeback: Rückbuchung höchstens bis zum verfügbaren Guthaben, kein negativer Stand;
 * Restforderung getrennt als TokenDebt.
 */
export async function chargebackTokens(tx: Tx, profileId: string, tokens: number, orderId: string) {
  const balance = await lockProfileBalance(tx, profileId);
  const take = Math.min(balance, tokens);
  if (take > 0) {
    await postLedger(tx, { profileId, delta: -take, kind: "chargeback", idemKey: `chargeback:${orderId}`, refType: "order", refId: orderId });
  }
  const rest = tokens - take;
  if (rest > 0) await tx.tokenDebt.create({ data: { profileId, tokens: rest, orderId } });
  return { reversed: take, debt: rest };
}

export async function hasOpenTokenDebt(profileId: string, tx: Tx = db) {
  return (await tx.tokenDebt.count({ where: { profileId, settledAt: null } })) > 0;
}
