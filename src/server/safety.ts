import { db } from "./db";
import { forbidden } from "./errors";
import { cancelOpenGamesFor } from "./games";
import { audit } from "./audit";
import { enqueue } from "./outbox";
import { orderedPair } from "@/domain/messaging";

/** Blockieren wirkt sofort: Kontakt, offene Anfragen, Spiele, Anrufe. */
export async function blockProfile(userId: string, blockerId: string, blockedId: string) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId: blockerId, status: "active" } });
  if (!m || blockerId === blockedId) throw forbidden();
  await db.$transaction(async (tx) => {
    await tx.block.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
    const [a, b] = orderedPair(blockerId, blockedId);
    await tx.connection.updateMany({ where: { aId: a, bId: b, endedAt: null }, data: { endedAt: new Date() } });
    await tx.contactRequest.updateMany({
      where: { status: "pending", OR: [{ fromId: blockerId, toId: blockedId }, { fromId: blockedId, toId: blockerId }] },
      data: { status: "withdrawn" },
    });
    // Spiele zwischen beiden beenden
    const shared = await tx.gameSession.findMany({
      where: {
        status: { in: ["invited", "accepted", "answering"] },
        AND: [{ participants: { some: { profileId: blockerId } } }, { participants: { some: { profileId: blockedId } } }],
      },
    });
    for (const s of shared) await tx.gameSession.update({ where: { id: s.id }, data: { status: "cancelled" } });
    const calls = await tx.callSession.findMany({
      where: { status: { in: ["ringing", "active"] }, OR: [{ callerProfileId: blockerId, calleeProfileId: blockedId }, { callerProfileId: blockedId, calleeProfileId: blockerId }] },
    });
    for (const c of calls) {
      await tx.callSession.update({ where: { id: c.id }, data: { status: "revoked", endedAt: new Date(), endReason: "block" } });
      await enqueue(tx, "call.revoke", { roomName: c.roomName });
    }
  });
}

export async function unblockProfile(userId: string, blockerId: string, blockedId: string) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId: blockerId, status: "active" } });
  if (!m) throw forbidden();
  await db.block.deleteMany({ where: { blockerId, blockedId } });
}

/** Rechteentzug (Verifizierung entzogen, Sperre, Paartrennung): Sitzungen/Räume/Spiele bereinigen. */
export async function onRightsRevoked(userId: string, reason: string) {
  const memberships = await db.profileMembership.findMany({ where: { userId } });
  await db.$transaction(async (tx) => {
    for (const m of memberships) {
      await cancelOpenGamesFor(tx, m.profileId, reason);
      const calls = await tx.callSession.findMany({
        where: { status: { in: ["ringing", "active"] }, OR: [{ callerProfileId: m.profileId }, { calleeProfileId: m.profileId }] },
      });
      for (const c of calls) {
        await tx.callSession.update({ where: { id: c.id }, data: { status: "revoked", endedAt: new Date(), endReason: reason } });
        await enqueue(tx, "call.revoke", { roomName: c.roomName });
      }
    }
    await audit("rights.revoked", { targetType: "user", targetId: userId, meta: { reason } }, tx);
  });
}
