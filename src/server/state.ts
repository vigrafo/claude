import { db, type Tx } from "./db";
import type { PersonState, ProfileState } from "@/domain/access";
import { profileVerified } from "@/domain/access";
import type { PlanKey } from "@/domain/plans";

/** Aktiver Tarif einer Person aus Entitlements (nur bestätigte, nicht widerrufene, gültige). */
export async function activePlan(userId: string, tx: Tx = db, now = new Date()): Promise<PlanKey> {
  const ents = await tx.entitlement.findMany({
    where: {
      userId, revokedAt: null, validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
  });
  if (ents.some((e) => e.key === "plan:gold")) return "gold";
  if (ents.some((e) => e.key === "plan:premium")) return "premium";
  return "basis";
}

export async function personState(userId: string, tx: Tx = db): Promise<PersonState | null> {
  const u = await tx.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    userId: u.id,
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    adultConfirmed: !!u.adultConfirmedAt,
    identityStatus: u.identityStatus,
    identityExpiresAt: u.identityExpiresAt,
    plan: await activePlan(u.id, tx),
  };
}

export async function profileState(profileId: string, tx: Tx = db): Promise<ProfileState | null> {
  const p = await tx.communityProfile.findUnique({
    where: { id: profileId },
    include: { memberships: { where: { status: "active" } } },
  });
  if (!p) return null;
  const members: PersonState[] = [];
  for (const m of p.memberships) {
    const ps = await personState(m.userId, tx);
    if (ps) members.push(ps);
  }
  return { profileId: p.id, type: p.type, status: p.status, members };
}

/** Neuberechnung des gecachten Badges nach jeder relevanten Änderung. */
export async function refreshProfileBadge(profileId: string, tx: Tx = db): Promise<boolean> {
  const st = await profileState(profileId, tx);
  const verified = st ? profileVerified(st) : false;
  await tx.communityProfile.update({ where: { id: profileId }, data: { verifiedBadge: verified } });
  return verified;
}

export async function refreshBadgesForUser(userId: string, tx: Tx = db): Promise<void> {
  const ms = await tx.profileMembership.findMany({ where: { userId } });
  for (const m of ms) await refreshProfileBadge(m.profileId, tx);
}

export async function isBlockedEitherWay(a: string, b: string, tx: Tx = db): Promise<boolean> {
  const n = await tx.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return n > 0;
}

export async function areConnected(a: string, b: string, tx: Tx = db): Promise<boolean> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const c = await tx.connection.findUnique({ where: { aId_bId: { aId: x, bId: y } } });
  return !!c && !c.endedAt;
}
