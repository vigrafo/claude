import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { db } from "./db";
import { AppError, forbidden } from "./errors";
import { can } from "@/domain/access";
import { areConnected, isBlockedEitherWay, personState, profileState } from "./state";
import { randomToken } from "./crypto";
import { getSetting } from "./settings";

/**
 * In-App-Audio/Video über selbst gehostetes LiveKit. Kurzlebige Raumtokens mit minimalen Rechten.
 * Keine Aufzeichnung, keine Admin-Mithörfunktion. Transportverschlüsselung (DTLS-SRTP/TLS);
 * Ende-zu-Ende-Verschlüsselung wird NICHT behauptet.
 */
export function livekitConfigured() {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

async function checkPair(userId: string, profileId: string, otherProfileId: string) {
  const actor = await personState(userId);
  const prof = await profileState(profileId);
  const other = await profileState(otherProfileId);
  if (!actor || !prof || !other) throw forbidden();
  const mine = can("calls", actor, prof);
  if (!mine.allowed) throw forbidden(mine.reason);
  // Gegenseite: mindestens eine Person mit Premium/Gold & vollständige Verifizierung
  const otherOk = other.members.some((m) => can("calls", m, other).allowed);
  if (!otherOk) throw forbidden("Das andere Profil kann derzeit keine Anrufe nutzen.");
  if (await isBlockedEitherWay(profileId, otherProfileId)) throw forbidden();
  if (!(await areConnected(profileId, otherProfileId))) throw forbidden("Anrufe sind nur mit bestätigten Kontakten möglich.");
}

export async function startCall(userId: string, profileId: string, calleeProfileId: string, mode: "audio" | "video") {
  if (!livekitConfigured()) throw new AppError("rtc_unconfigured", "Anrufe sind auf diesem Server noch nicht eingerichtet.", 503);
  const limits = await getSetting("calls.limits");
  await checkPair(userId, profileId, calleeProfileId);
  if (mode === "video" && !limits.videoEnabled) throw forbidden("Videoanrufe sind derzeit deaktiviert.");
  const busy = await db.callSession.count({ where: { status: { in: ["ringing", "active"] }, OR: [{ callerProfileId: calleeProfileId }, { calleeProfileId }] } });
  if (busy) return { status: "busy" as const };
  const today = new Date(Date.now() - 86400_000);
  const started = await db.callSession.count({ where: { callerProfileId: profileId, createdAt: { gte: today } } });
  if (started >= limits.maxCallsPerDay) throw new AppError("limit", `Tageslimit von ${limits.maxCallsPerDay} Anrufen erreicht.`, 429);
  const call = await db.callSession.create({
    data: { roomName: `call_${randomToken(12)}`, callerProfileId: profileId, calleeProfileId, callerUserId: userId, mode },
  });
  return { status: "ringing" as const, callId: call.id, token: await roomToken(call.roomName, userId, mode, limits.maxMinutes) };
}

export async function answerCall(userId: string, profileId: string, callId: string, accept: boolean) {
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call || call.calleeProfileId !== profileId || call.status !== "ringing") throw forbidden();
  if (!accept) {
    await db.callSession.update({ where: { id: callId }, data: { status: "declined", endedAt: new Date() } });
    return { status: "declined" as const };
  }
  await checkPair(userId, profileId, call.callerProfileId);
  const limits = await getSetting("calls.limits");
  await db.callSession.update({ where: { id: callId }, data: { status: "active", answeredAt: new Date() } });
  return { status: "active" as const, token: await roomToken(call.roomName, userId, call.mode as "audio" | "video", limits.maxMinutes) };
}

export async function endCall(userId: string, profileId: string, callId: string) {
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call || (call.callerProfileId !== profileId && call.calleeProfileId !== profileId)) throw forbidden();
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw forbidden();
  await db.callSession.update({
    where: { id: callId },
    data: { status: call.status === "ringing" ? "missed" : "ended", endedAt: new Date(), endReason: "hangup" },
  });
  await revokeRoom(call.roomName);
}

async function roomToken(roomName: string, identity: string, mode: "audio" | "video", maxMinutes: number) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, ttl: `${Math.min(maxMinutes, 240)}m` });
  at.addGrant({
    room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false, roomRecord: false, roomAdmin: false,
    canPublishSources: mode === "audio" ? ["microphone" as never] : ["microphone" as never, "camera" as never],
  });
  return at.toJwt();
}

/** Serverseitiges Entfernen bei Rechteentzug/Blockierung (vom Worker über Outbox aufgerufen). */
export async function revokeRoom(roomName: string) {
  if (!livekitConfigured()) return;
  const http = process.env.LIVEKIT_URL!.replace(/^wss?:/, "https:");
  const svc = new RoomServiceClient(http, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await svc.deleteRoom(roomName).catch(() => undefined);
}
