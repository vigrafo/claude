import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { db } from "./db";
import { AppError, forbidden } from "./errors";
import { can } from "@/domain/access";
import { areConnected, isBlockedEitherWay, personState, profileState } from "./state";
import { randomToken } from "./crypto";
import { getSetting } from "./settings";
import { audit } from "./audit";

/**
 * In-App-Audio/Video über selbst gehostetes LiveKit. Kurzlebige Raumtokens mit minimalen Rechten.
 * Keine Aufzeichnung, keine Admin-Mithörfunktion. Transportverschlüsselung (DTLS-SRTP/TLS);
 * Ende-zu-Ende-Verschlüsselung wird NICHT behauptet.
 *
 * Ablauf: Anrufer startet → Raum + Token (Status ringing) → Angerufene:r sieht eingehenden Anruf
 * (Polling) → Annahme → beide erhalten bei JEDEM Beitritt ein frisch geprüftes Token (joinCall).
 * Rechteentzug/Blockierung → Raum wird serverseitig gelöscht (Teilnehmende fliegen raus).
 */
export function livekitConfigured() {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

/** Öffentliche WebSocket-URL für Browser (kann von der internen API-URL abweichen). */
export function livekitPublicUrl() {
  return process.env.LIVEKIT_PUBLIC_URL ?? process.env.LIVEKIT_URL ?? "";
}

/** Relay-Zwang (nur TURN) verhindert die Offenlegung der eigenen IP gegenüber der Gegenseite. Standard: an. */
export function forceRelay() {
  return process.env.CALLS_FORCE_RELAY !== "false";
}

export const RING_TIMEOUT_MS = 60_000;

async function checkPair(userId: string, profileId: string, otherProfileId: string) {
  const actor = await personState(userId);
  const prof = await profileState(profileId);
  const other = await profileState(otherProfileId);
  if (!actor || !prof || !other) throw forbidden();
  if (!prof.members.some((m) => m.userId === userId)) throw forbidden();
  const mine = can("calls", actor, prof);
  if (!mine.allowed) throw forbidden(mine.reason);
  // Gegenseite: mindestens eine Person mit Premium/Gold & vollständige Verifizierung
  const otherOk = other.members.some((m) => can("calls", m, other).allowed);
  if (!otherOk) throw forbidden("Das andere Profil kann derzeit keine Anrufe nutzen.");
  if (await isBlockedEitherWay(profileId, otherProfileId)) throw forbidden("Anruf nicht möglich.");
  if (!(await areConnected(profileId, otherProfileId))) throw forbidden("Anrufe sind nur mit bestätigten Kontakten möglich.");
}

export async function startCall(userId: string, profileId: string, calleeProfileId: string, mode: "audio" | "video") {
  if (!livekitConfigured()) throw new AppError("rtc_unconfigured", "Anrufe sind auf diesem Server noch nicht eingerichtet.", 503);
  const limits = await getSetting("calls.limits");
  await checkPair(userId, profileId, calleeProfileId);
  if (mode === "video" && !limits.videoEnabled) throw forbidden("Videoanrufe sind derzeit deaktiviert.");
  await expireRinging();
  const busy = await db.callSession.count({
    where: {
      status: { in: ["ringing", "active"] },
      OR: [{ callerProfileId: calleeProfileId }, { calleeProfileId }, { callerProfileId: profileId }, { calleeProfileId: profileId }],
    },
  });
  if (busy) return { status: "busy" as const };
  const today = new Date(Date.now() - 86400_000);
  const started = await db.callSession.count({ where: { callerProfileId: profileId, createdAt: { gte: today } } });
  if (started >= limits.maxCallsPerDay) throw new AppError("limit", `Tageslimit von ${limits.maxCallsPerDay} Anrufen erreicht.`, 429);
  const call = await db.callSession.create({
    data: { roomName: `call_${randomToken(12)}`, callerProfileId: profileId, calleeProfileId, callerUserId: userId, mode },
  });
  const calleeMembers = await db.profileMembership.findMany({ where: { profileId: calleeProfileId, status: "active" } });
  await db.notification.createMany({ data: calleeMembers.map((m) => ({ userId: m.userId, kind: "call", title: "Eingehender Anruf", link: "/app/anrufe" })) });
  return { status: "ringing" as const, callId: call.id };
}

export async function answerCall(userId: string, profileId: string, callId: string, accept: boolean) {
  await expireRinging();
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call || call.calleeProfileId !== profileId) throw forbidden();
  if (call.status !== "ringing") throw new AppError("not_ringing", "Dieser Anruf ist nicht mehr aktiv.");
  if (!accept) {
    await db.callSession.update({ where: { id: callId }, data: { status: "declined", endedAt: new Date(), endReason: "declined" } });
    await revokeRoom(call.roomName);
    return { status: "declined" as const };
  }
  await checkPair(userId, profileId, call.callerProfileId);
  // Atomarer Statuswechsel – verhindert doppelte Annahme
  const upd = await db.callSession.updateMany({ where: { id: callId, status: "ringing" }, data: { status: "active", answeredAt: new Date() } });
  if (upd.count !== 1) throw new AppError("not_ringing", "Dieser Anruf ist nicht mehr aktiv.");
  return { status: "active" as const, callId };
}

/**
 * Stellt beim Beitritt ein frisch geprüftes, kurzlebiges Token aus.
 * Anrufer:in darf während „ringing“ und „active“ beitreten, Angerufene:r nur bei „active“.
 */
export async function joinCall(userId: string, profileId: string, callId: string) {
  if (!livekitConfigured()) throw new AppError("rtc_unconfigured", "Anrufe sind auf diesem Server noch nicht eingerichtet.", 503);
  await expireRinging();
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call) throw forbidden();
  const isCaller = call.callerProfileId === profileId;
  const isCallee = call.calleeProfileId === profileId;
  if (!isCaller && !isCallee) throw forbidden();
  const allowed = call.status === "active" || (call.status === "ringing" && isCaller);
  if (!allowed) throw new AppError("call_closed", callStatusText(call.status), 410);
  const other = isCaller ? call.calleeProfileId : call.callerProfileId;
  await checkPair(userId, profileId, other);
  const limits = await getSetting("calls.limits");
  const startedAt = call.answeredAt ?? call.createdAt;
  const remainingMin = Math.max(1, Math.ceil((startedAt.getTime() + limits.maxMinutes * 60_000 - Date.now()) / 60_000));
  if (call.answeredAt && Date.now() - call.answeredAt.getTime() > limits.maxMinutes * 60_000) {
    await finishCall(call.id, "ended", "max_duration");
    throw new AppError("call_closed", "Die maximale Gesprächsdauer ist erreicht.", 410);
  }
  const otherProfile = await db.communityProfile.findUnique({ where: { id: other }, select: { handle: true } });
  const token = await roomToken(call.roomName, `${profileId}:${userId}`, call.mode as "audio" | "video", Math.min(remainingMin, limits.maxMinutes));
  return {
    callId: call.id, status: call.status, mode: call.mode as "audio" | "video", role: isCaller ? ("caller" as const) : ("callee" as const),
    token, url: livekitPublicUrl(), forceRelay: forceRelay(), otherHandle: otherProfile?.handle ?? "Kontakt",
    maxMinutes: limits.maxMinutes, maxBitrateKbps: limits.maxBitrateKbps, startedAt: startedAt.toISOString(),
  };
}

export function callStatusText(status: string) {
  switch (status) {
    case "ringing": return "Es klingelt …";
    case "active": return "Verbunden";
    case "declined": return "Der Anruf wurde abgelehnt.";
    case "missed": return "Der Anruf wurde nicht angenommen.";
    case "busy": return "Besetzt.";
    case "revoked": return "Der Anruf wurde beendet, weil die Berechtigung nicht mehr besteht.";
    case "failed": return "Die Verbindung ist fehlgeschlagen.";
    default: return "Der Anruf ist beendet.";
  }
}

export async function endCall(userId: string, profileId: string, callId: string) {
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call || (call.callerProfileId !== profileId && call.calleeProfileId !== profileId)) throw forbidden();
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw forbidden();
  if (call.status !== "ringing" && call.status !== "active") return;
  await finishCall(call.id, call.status === "ringing" ? (call.callerProfileId === profileId ? "ended" : "declined") : "ended", "hangup");
}

/** Technischer Fehler im Client (z. B. keine Verbindung) – nur Metadaten. */
export async function reportCallFailure(userId: string, profileId: string, callId: string, reason: string) {
  const call = await db.callSession.findUnique({ where: { id: callId } });
  if (!call || (call.callerProfileId !== profileId && call.calleeProfileId !== profileId)) throw forbidden();
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw forbidden();
  if (call.status === "ringing" || call.status === "active") await finishCall(call.id, "failed", reason.slice(0, 60));
}

async function finishCall(callId: string, status: string, reason: string) {
  const call = await db.callSession.update({ where: { id: callId }, data: { status, endedAt: new Date(), endReason: reason } });
  await revokeRoom(call.roomName);
  await audit("call.ended", { targetType: "call", targetId: callId, meta: { status, reason } });
}

/** Nicht angenommene Anrufe nach 60 Sekunden als verpasst markieren. */
export async function expireRinging(now = new Date()) {
  const stale = await db.callSession.findMany({ where: { status: "ringing", createdAt: { lte: new Date(now.getTime() - RING_TIMEOUT_MS) } } });
  for (const c of stale) {
    await db.callSession.updateMany({ where: { id: c.id, status: "ringing" }, data: { status: "missed", endedAt: now, endReason: "timeout" } });
    await revokeRoom(c.roomName);
  }
  return stale.length;
}

/** Zustand für Polling (eigene laufende/klingelnde Anrufe) – nur Metadaten, keine Inhalte. */
export async function callStatus(userId: string, profileId: string, callId?: string) {
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!member) throw forbidden();
  await expireRinging();
  if (callId) {
    const c = await db.callSession.findUnique({ where: { id: callId } });
    if (!c || (c.callerProfileId !== profileId && c.calleeProfileId !== profileId)) throw forbidden();
    return { call: { id: c.id, status: c.status, text: callStatusText(c.status) } };
  }
  const incoming = await db.callSession.findMany({
    where: { calleeProfileId: profileId, status: "ringing" }, orderBy: { createdAt: "desc" }, take: 3,
  });
  const handles = new Map(
    (await db.communityProfile.findMany({ where: { id: { in: incoming.map((i) => i.callerProfileId) } }, select: { id: true, handle: true } })).map((p) => [p.id, p.handle]),
  );
  return { incoming: incoming.map((i) => ({ id: i.id, mode: i.mode, from: handles.get(i.callerProfileId) ?? "Kontakt" })) };
}

async function roomToken(roomName: string, identity: string, mode: "audio" | "video", ttlMinutes: number) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, ttl: `${Math.max(1, Math.min(ttlMinutes, 240))}m` });
  at.addGrant({
    room: roomName, roomJoin: true, roomCreate: true, canPublish: true, canSubscribe: true, canPublishData: false,
    roomRecord: false, roomAdmin: false, roomList: false, hidden: false,
    canPublishSources: mode === "audio" ? [TrackSource.MICROPHONE] : [TrackSource.MICROPHONE, TrackSource.CAMERA],
  });
  return at.toJwt();
}

/** Serverseitiges Entfernen bei Ende/Rechteentzug/Blockierung (auch vom Worker über Outbox aufgerufen). */
export async function revokeRoom(roomName: string) {
  if (!livekitConfigured()) return;
  const http = (process.env.LIVEKIT_API_URL ?? process.env.LIVEKIT_URL!).replace(/^ws(s?):/, "http$1:");
  const svc = new RoomServiceClient(http, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await svc.deleteRoom(roomName).catch(() => undefined);
}
