import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "@/server/db";
import { processImage, uploadImage, setVisibility, deleteOwnMedia, GALLERY_LIMIT } from "@/server/uploads";
import { canViewMedia } from "@/server/media";
import { resetStorageForTests, storage } from "@/server/storage";
import { sendMessage } from "@/server/messaging";
import { blockProfile } from "@/server/safety";
import { answerCall, joinCall, startCall, expireRinging, endCall } from "@/server/calls";
import { connect, makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(async () => {
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "eropub-media-"));
  resetStorageForTests();
  await prepareDb();
});

async function jpegWithExif(w = 400, h = 300) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 60 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Geheim", Artist: "Max Mustermann" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 31/1 0/1" } })
    .toBuffer();
}

describe("Bildverarbeitung", () => {
  it("entfernt EXIF/GPS und speichert als WebP", async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processImage(input);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(out.data.includes(Buffer.from("Mustermann"))).toBe(false);
  });

  it("verkleinert große Bilder auf höchstens 2048 px", async () => {
    const big = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#fff" } }).png().toBuffer();
    const out = await processImage(big);
    expect(out.width).toBe(2048);
  });

  it("weist SVG, HTML, GIF, leere und winzige Dateien ab", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><rect width="100" height="100"/></svg>');
    await expect(processImage(svg)).rejects.toMatchObject({ code: "upload_type" });
    await expect(processImage(Buffer.from("<html><body>x</body></html>"))).rejects.toMatchObject({ code: "upload_type" });
    const gif = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(processImage(gif)).rejects.toMatchObject({ code: "upload_type" });
    await expect(processImage(Buffer.alloc(0))).rejects.toMatchObject({ code: "upload_empty" });
    const tiny = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).png().toBuffer();
    await expect(processImage(tiny)).rejects.toMatchObject({ code: "upload_dim" });
  });
});

describe("Uploads & Sichtbarkeit", () => {
  it("Rechtebestätigung nötig; neues Bild ist bis zur Moderation nur für Eigentümer sichtbar", async () => {
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    await expect(uploadImage({ userId: u.id, profileId: p.id, file: await jpegWithExif(), purpose: "gallery", rightsConfirmed: false })).rejects.toMatchObject({ code: "rights" });
    const a = await uploadImage({ userId: u.id, profileId: p.id, file: await jpegWithExif(), purpose: "gallery", visibility: "verified_members", rightsConfirmed: true });
    expect(a.moderation).toBe("pending");
    expect(await storage().get(a.storageKey)).not.toBeNull();
    const v = await makeUser();
    const vp = await makeProfile("single", [v]);
    await db.communityProfile.update({ where: { id: vp.id }, data: { verifiedBadge: true } });
    expect(await canViewMedia(u.id, p.id, a.id)).not.toBeNull();
    expect(await canViewMedia(v.id, vp.id, a.id)).toBeNull();
    await db.mediaAsset.update({ where: { id: a.id }, data: { moderation: "approved" } });
    expect(await canViewMedia(v.id, vp.id, a.id)).not.toBeNull();
    // Freigabe auf Kontakte einschränken → nicht verbunden = unsichtbar
    await setVisibility(u.id, p.id, a.id, "contacts");
    expect(await canViewMedia(v.id, vp.id, a.id)).toBeNull();
    await connect(p.id, vp.id);
    expect(await canViewMedia(v.id, vp.id, a.id)).not.toBeNull();
    // Blockieren hat Vorrang
    await blockProfile(u.id, p.id, vp.id);
    expect(await canViewMedia(v.id, vp.id, a.id)).toBeNull();
    // Fremde können nicht ändern/löschen (IDOR)
    await expect(setVisibility(v.id, p.id, a.id, "private")).rejects.toMatchObject({ status: 403 });
    await expect(deleteOwnMedia(v.id, vp.id, a.id)).rejects.toMatchObject({ status: 404 });
    await deleteOwnMedia(u.id, p.id, a.id);
    expect(await storage().get(a.storageKey)).toBeNull();
  });

  it("Galerie-Limit und Gruppengalerie nur mit Berechtigung", async () => {
    const u = await makeUser();
    const p = await makeProfile("single", [u]);
    await db.mediaAsset.createMany({
      data: Array.from({ length: GALLERY_LIMIT }, (_, i) => ({ ownerId: p.id, storageKey: `gallery/x/${p.id.toLowerCase()}${i}.webp`, mime: "image/webp", bytes: 1, purpose: "gallery" })),
    });
    await expect(uploadImage({ userId: u.id, profileId: p.id, file: await jpegWithExif(), purpose: "gallery", rightsConfirmed: true })).rejects.toMatchObject({ code: "gallery_full" });
    const g = await db.group.findFirstOrThrow({ where: { official: true } });
    await expect(uploadImage({ userId: u.id, profileId: p.id, file: await jpegWithExif(), purpose: "group", scopeId: g.id, rightsConfirmed: true })).rejects.toMatchObject({ status: 403 });
  });

  it("Chatbild: nicht als erste Anfrage, kostet 1 Token (Basis), nur für Teilnehmende sichtbar, nicht wiederverwendbar", async () => {
    const ua = await makeUser({ verified: false });
    const ub = await makeUser();
    const uc = await makeUser();
    const a = await makeProfile("single", [ua], 5);
    const b = await makeProfile("single", [ub]);
    const c = await makeProfile("single", [uc]);
    // Erste Nachricht = Anfrage
    const first = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "Hallo", clientKey: "t1" });
    const img = await uploadImage({ userId: ua.id, profileId: a.id, file: await jpegWithExif(), purpose: "message", scopeId: first.conversationId, rightsConfirmed: true });
    await expect(sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "", clientKey: "t2", kind: "media", mediaId: img.id })).rejects.toMatchObject({ status: 403 });
    await connect(a.id, b.id);
    const r = await sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "", clientKey: "t3", kind: "media", mediaId: img.id });
    expect(r.tokenCost).toBe(1);
    await expect(sendMessage({ actorUserId: ua.id, fromProfileId: a.id, toProfileId: b.id, body: "", clientKey: "t4", kind: "media", mediaId: img.id })).rejects.toMatchObject({ code: "media_invalid" });
    expect(await canViewMedia(ub.id, b.id, img.id)).not.toBeNull();
    expect(await canViewMedia(uc.id, c.id, img.id)).toBeNull();
    // Fremdes Bild kann nicht als eigenes gesendet werden
    await expect(sendMessage({ actorUserId: ub.id, fromProfileId: b.id, toProfileId: a.id, body: "", clientKey: "t5", kind: "media", mediaId: img.id })).rejects.toMatchObject({ code: "media_invalid" });
  });
});

describe("Anrufe (Server)", () => {
  beforeAll(() => {
    process.env.LIVEKIT_URL = "ws://127.0.0.1:9";
    process.env.LIVEKIT_API_KEY = "testkey";
    process.env.LIVEKIT_API_SECRET = "testsecret-testsecret-testsecret-123";
    delete process.env.CALLS_FORCE_RELAY; // Standard (Relay-Zwang) prüfen – unabhängig von lokaler .env
  });

  async function pair() {
    const ua = await makeUser({ plan: "premium" });
    const ub = await makeUser({ plan: "gold" });
    const a = await makeProfile("single", [ua]);
    const b = await makeProfile("single", [ub]);
    await db.communityProfile.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { verifiedBadge: true } });
    await connect(a.id, b.id);
    return { ua, ub, a, b };
  }

  function decode(jwt: string) {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  }

  it("Token mit Minimalrechten; Angerufene:r erst nach Annahme; Audio nur Mikrofon", async () => {
    const { ua, ub, a, b } = await pair();
    const s = await startCall(ua.id, a.id, b.id, "audio");
    expect(s.status).toBe("ringing");
    const callId = (s as { callId: string }).callId;
    const j = await joinCall(ua.id, a.id, callId);
    const claims = decode(j.token);
    expect(claims.video.room).toMatch(/^call_/);
    expect(claims.video.canPublishSources).toEqual(["microphone"]);
    expect(claims.video.roomRecord ?? false).toBe(false);
    expect(claims.video.roomAdmin ?? false).toBe(false);
    expect(j.forceRelay).toBe(true);
    await expect(joinCall(ub.id, b.id, callId)).rejects.toMatchObject({ code: "call_closed" });
    await answerCall(ub.id, b.id, callId, true);
    await expect(answerCall(ub.id, b.id, callId, true)).rejects.toMatchObject({ code: "not_ringing" });
    const jb = await joinCall(ub.id, b.id, callId);
    expect(decode(jb.token).video.room).toBe(claims.video.room);
    await endCall(ua.id, a.id, callId);
    await expect(joinCall(ub.id, b.id, callId)).rejects.toMatchObject({ code: "call_closed" });
  });

  it("Video erlaubt Kamera; Dritte, Basis und Blockierte erhalten kein Token", async () => {
    const { ua, ub, a, b } = await pair();
    const s = (await startCall(ua.id, a.id, b.id, "video")) as { callId: string };
    expect(decode((await joinCall(ua.id, a.id, s.callId)).token).video.canPublishSources).toEqual(["microphone", "camera"]);
    const ux = await makeUser({ plan: "gold" });
    const x = await makeProfile("single", [ux]);
    await expect(joinCall(ux.id, x.id, s.callId)).rejects.toMatchObject({ status: 403 });
    await expect(joinCall(ux.id, a.id, s.callId)).rejects.toMatchObject({ status: 403 }); // fremdes Profil (IDOR)
    await answerCall(ub.id, b.id, s.callId, true);
    await blockProfile(ub.id, b.id, a.id);
    await expect(joinCall(ua.id, a.id, s.callId)).rejects.toBeTruthy();
    // Basis-Mitglied kann keine Anrufe starten
    const ubasis = await makeUser();
    const pbasis = await makeProfile("single", [ubasis]);
    await connect(pbasis.id, a.id);
    await expect(startCall(ubasis.id, pbasis.id, a.id, "audio")).rejects.toMatchObject({ status: 403 });
  });

  it("nicht angenommene Anrufe werden nach 60 s verpasst; besetzt bei laufendem Anruf", async () => {
    const { ua, ub, a, b } = await pair();
    const s = (await startCall(ua.id, a.id, b.id, "audio")) as { callId: string };
    expect((await startCall(ua.id, a.id, b.id, "audio")).status).toBe("busy");
    await expireRinging(new Date(Date.now() + 61_000));
    expect((await db.callSession.findUniqueOrThrow({ where: { id: s.callId } })).status).toBe("missed");
    expect(await db.notification.count({ where: { userId: ub.id, kind: "call" } })).toBeGreaterThan(0);
  });
});
