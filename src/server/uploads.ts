import sharp, { type Metadata } from "sharp";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { getSetting } from "./settings";
import { rateLimit } from "./ratelimit";
import { storage } from "./storage";
import { audit } from "./audit";
import { assertMember } from "./contacts";
import { groupGalleryAllowed } from "./media";
import { isBlockedEitherWay } from "./state";

/**
 * Bild-Upload-Pipeline:
 *  1. Größenlimit (Einstellung uploads.limits) vor der Verarbeitung
 *  2. Format anhand des Dateiinhalts (nicht Dateiname/MIME des Browsers): nur JPEG, PNG, WebP.
 *     SVG, HTML, GIF, HEIC usw. werden abgewiesen.
 *  3. Dekodieren mit Pixel-Limit (Schutz vor Dekompressionsbomben)
 *  4. EXIF-Ausrichtung anwenden, auf max. 2048 px verkleinern, NEU als WebP kodieren →
 *     sämtliche Metadaten (EXIF inkl. GPS, IPTC, XMP, ICC) werden verworfen
 *  5. Ablage im privaten Speicher unter zufälligem Schlüssel; Moderation „pending“
 *     (Ausnahme: Chatbilder – privat zwischen zwei Profilen, werden beim Empfänger verborgen angezeigt und sind meldbar)
 */
export const MAX_DIMENSION = 2048;
export const MAX_INPUT_PIXELS = 40_000_000;
export const GALLERY_LIMIT = 30;

export type UploadPurpose = "profile" | "gallery" | "group" | "message";
export type Visibility = "private" | "contacts" | "verified_members" | "group";

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  mime: "image/webp";
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const limits = await getSetting("uploads.limits");
  if (input.length === 0) throw new AppError("upload_empty", "Die Datei ist leer.");
  if (input.length > limits.maxImageBytes) {
    throw new AppError("upload_size", `Die Datei ist zu groß (höchstens ${Math.round(limits.maxImageBytes / 1_000_000)} MB).`);
  }
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new AppError("upload_type", "Die Datei ist kein gültiges Bild. Erlaubt sind JPEG, PNG und WebP.");
  }
  const formatMime: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const detected = meta.format ? formatMime[meta.format] : undefined;
  if (!detected || !(limits.allowedMime as string[]).includes(detected)) {
    throw new AppError("upload_type", "Dieses Dateiformat ist nicht erlaubt. Erlaubt sind JPEG, PNG und WebP.");
  }
  if ((meta.pages ?? 1) > 1) throw new AppError("upload_type", "Animierte Bilder sind nicht erlaubt.");
  if (!meta.width || !meta.height || meta.width < 64 || meta.height < 64) throw new AppError("upload_dim", "Das Bild ist zu klein (mindestens 64 × 64 Pixel).");
  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // EXIF-Ausrichtung anwenden, bevor die Metadaten verworfen werden
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }) // keine .withMetadata() → keine Metadaten im Ergebnis
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, mime: "image/webp" };
  } catch {
    throw new AppError("upload_type", "Das Bild konnte nicht verarbeitet werden.");
  }
}

export interface UploadInput {
  userId: string;
  profileId: string;
  file: Buffer;
  purpose: UploadPurpose;
  visibility?: Visibility;
  scopeId?: string; // groupId bzw. conversationId
  rightsConfirmed: boolean;
}

export async function uploadImage(input: UploadInput) {
  await assertMember(input.userId, input.profileId);
  if (!input.rightsConfirmed) {
    throw new AppError("rights", "Bitte bestätige, dass du die Rechte am Bild hast und alle erkennbaren Personen einverstanden sind.");
  }
  const profile = await db.communityProfile.findUnique({ where: { id: input.profileId } });
  if (!profile || profile.status !== "active") throw forbidden("Profil ist nicht aktiv.");
  await rateLimit("upload", input.profileId, 30, 3600);

  let visibility: Visibility;
  let scopeId: string | null = null;
  let moderation = "pending";
  switch (input.purpose) {
    case "profile":
      visibility = input.visibility === "contacts" ? "contacts" : "verified_members";
      break;
    case "gallery": {
      const n = await db.mediaAsset.count({ where: { ownerId: input.profileId, purpose: "gallery", deletedAt: null } });
      if (n >= GALLERY_LIMIT) throw new AppError("gallery_full", `Deine Galerie ist voll (höchstens ${GALLERY_LIMIT} Bilder).`);
      visibility = input.visibility === "private" || input.visibility === "verified_members" ? input.visibility : "contacts";
      break;
    }
    case "group": {
      if (!input.scopeId || !(await groupGalleryAllowed(input.userId, input.profileId, input.scopeId))) {
        throw forbidden("Gruppengalerie nicht verfügbar.");
      }
      const gm = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId: input.scopeId, profileId: input.profileId } } });
      if (!gm?.canWrite) throw forbidden("Du hast in dieser Gruppe keine Schreibfreigabe.");
      visibility = "group";
      scopeId = input.scopeId;
      break;
    }
    case "message": {
      if (!input.scopeId) throw forbidden();
      const part = await db.conversationParticipant.findUnique({
        where: { conversationId_profileId: { conversationId: input.scopeId, profileId: input.profileId } },
      });
      if (!part) throw forbidden();
      visibility = "private";
      scopeId = input.scopeId;
      moderation = "approved"; // privat zwischen zwei Profilen; Empfänger sieht es erst nach Klick; meldbar
      break;
    }
    default:
      throw forbidden();
  }

  const img = await processImage(input.file);
  const key = `${input.purpose}/${input.profileId.toLowerCase()}/${randomBytes(16).toString("hex")}.webp`;
  await storage().put(key, img.data, img.mime);
  try {
    const asset = await db.mediaAsset.create({
      data: {
        ownerId: input.profileId, storageKey: key, mime: img.mime, bytes: img.data.length, width: img.width, height: img.height,
        purpose: input.purpose, visibility, scopeId, moderation, rightsNote: `Rechte bestätigt durch Konto ${input.userId.slice(-6)} am ${new Date().toISOString().slice(0, 10)}`,
      },
    });
    await audit("media.uploaded", { actorUserId: input.userId, targetType: "media", targetId: asset.id, meta: { purpose: input.purpose } });
    return asset;
  } catch (e) {
    await storage().del(key);
    throw e;
  }
}

async function ownAsset(userId: string, profileId: string, mediaId: string) {
  await assertMember(userId, profileId);
  const m = await db.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!m || m.ownerId !== profileId || m.deletedAt) throw notFound();
  return m;
}

/** Galeriefreigabe ändern (nur eigene Bilder). */
export async function setVisibility(userId: string, profileId: string, mediaId: string, visibility: Visibility) {
  const m = await ownAsset(userId, profileId, mediaId);
  if (m.purpose === "group" || m.purpose === "message") throw new AppError("visibility", "Die Sichtbarkeit dieses Bildes ist fest vorgegeben.");
  const allowed: Visibility[] = m.purpose === "profile" ? ["contacts", "verified_members"] : ["private", "contacts", "verified_members"];
  if (!allowed.includes(visibility)) throw new AppError("visibility", "Ungültige Sichtbarkeit.");
  await db.mediaAsset.update({ where: { id: m.id }, data: { visibility } });
}

/** Eigenes Bild löschen. Bei rechtlicher Sicherung (legalHold) bleibt die Datei für die Moderation erhalten. */
export async function deleteOwnMedia(userId: string, profileId: string, mediaId: string) {
  const m = await ownAsset(userId, profileId, mediaId);
  await db.mediaAsset.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
  if (!m.legalHold) await storage().del(m.storageKey);
  await audit("media.deleted_by_owner", { actorUserId: userId, targetType: "media", targetId: m.id });
}

/** Aktuelles Profilbild (freigegeben) – oder null. */
export async function profilePhoto(ownerId: string) {
  return db.mediaAsset.findFirst({
    where: { ownerId, purpose: "profile", moderation: "approved", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, visibility: true },
  });
}

/** Profilbilder für eine Liste von Profilen, die die betrachtende Person sehen darf. */
export async function visibleProfilePhotos(viewerProfileId: string, ownerIds: string[]) {
  if (!ownerIds.length) return new Map<string, string>();
  const viewer = await db.communityProfile.findUnique({ where: { id: viewerProfileId }, select: { verifiedBadge: true } });
  const conns = await db.connection.findMany({
    where: { endedAt: null, OR: [{ aId: viewerProfileId, bId: { in: ownerIds } }, { bId: viewerProfileId, aId: { in: ownerIds } }] },
  });
  const connected = new Set(conns.map((c) => (c.aId === viewerProfileId ? c.bId : c.aId)));
  const photos = await db.mediaAsset.findMany({
    where: { ownerId: { in: ownerIds }, purpose: "profile", moderation: "approved", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, ownerId: true, visibility: true },
  });
  const out = new Map<string, string>();
  for (const p of photos) {
    if (out.has(p.ownerId)) continue;
    const ok = p.ownerId === viewerProfileId || connected.has(p.ownerId) || (p.visibility === "verified_members" && (viewer?.verifiedBadge ?? false));
    if (ok) out.set(p.ownerId, p.id);
  }
  // Blockierte nie anzeigen
  for (const id of [...out.keys()]) if (await isBlockedEitherWay(viewerProfileId, id)) out.delete(id);
  return out;
}

export async function listOwnMedia(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  return db.mediaAsset.findMany({
    where: { ownerId: profileId, deletedAt: null, purpose: { in: ["profile", "gallery"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** Galerie eines anderen Profils – nur Bilder, deren Freigabe die betrachtende Person erfüllt. */
export async function listVisibleGallery(viewerProfileId: string, ownerId: string) {
  if (await isBlockedEitherWay(viewerProfileId, ownerId)) return [];
  const viewer = await db.communityProfile.findUnique({ where: { id: viewerProfileId }, select: { verifiedBadge: true } });
  const [x, y] = viewerProfileId < ownerId ? [viewerProfileId, ownerId] : [ownerId, viewerProfileId];
  const conn = await db.connection.findUnique({ where: { aId_bId: { aId: x, bId: y } } });
  const connected = !!conn && !conn.endedAt;
  const vis: string[] = connected ? ["contacts", "verified_members"] : viewer?.verifiedBadge ? ["verified_members"] : [];
  if (!vis.length) return [];
  return db.mediaAsset.findMany({
    where: { ownerId, purpose: "gallery", moderation: "approved", deletedAt: null, visibility: { in: vis } },
    orderBy: { createdAt: "desc" },
    take: GALLERY_LIMIT,
    select: { id: true, width: true, height: true },
  });
}
