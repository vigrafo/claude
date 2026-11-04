import { db } from "./db";
import { notFound } from "./errors";
import { distanceBucket, haversineKm } from "@/domain/geo";
import { EUROPE } from "@/domain/countries";
import { getSetting } from "./settings";
import { agesOf, assertMember } from "./contacts";
import { areConnected, isBlockedEitherWay } from "./state";
import { lookingForLabel } from "@/app/app/_lib/options";

/**
 * Entdecken: Reihenfolge wird ausschließlich aus konkreten Gemeinsamkeiten berechnet und
 * als Klartext erklärt („2 gemeinsame Interessen: …“). Keine Prozentwerte, keine erfundenen Scores.
 * Entfernung nur in groben Stufen aus gerundeten Koordinaten.
 */

export interface DiscoverFilters {
  type?: "single" | "couple";
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  interests?: string[]; // Slugs
  verifiedOnly?: boolean;
}

export interface DiscoverItem {
  id: string;
  handle: string;
  type: "single" | "couple" | "organizer";
  ages: number[];
  region: string | null;
  headline: string | null;
  verified: boolean;
  distance: string | null;
  sharedInterests: string[];
  sharedLookingFor: string[];
  recentlyActive: boolean;
  reasons: string[];
  rank: number;
  isFavorite: boolean;
}

const BUCKET_ORDER = ["unter 10 km", "unter 25 km", "unter 50 km", "unter 100 km", "unter 250 km", "über 250 km"];

export function regionLabel(p: { regionCountry: string | null; regionName: string | null; regionCity?: string | null }): string | null {
  const country = EUROPE.find((c) => c.code === p.regionCountry)?.nameDe ?? null;
  const parts = [p.regionCity, p.regionName, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Profil-IDs, die mit dem Profil in irgendeiner Richtung blockiert sind. */
export async function blockedIds(profileId: string): Promise<Set<string>> {
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: profileId }, { blockedId: profileId }] } });
  return new Set(rows.map((b) => (b.blockerId === profileId ? b.blockedId : b.blockerId)));
}

/** Interessen sind je Eintrag nur für verifizierte Mitglieder bzw. Kontakte sichtbar. */
function visibleInterest(visibility: string, viewerVerified: boolean, connected: boolean): boolean {
  if (visibility === "contacts") return connected;
  if (visibility === "verified_members") return viewerVerified || connected;
  return false;
}

/** Aktive, sichtbare Profile: aktiv, alle Personen aktiv, nicht gelöscht/gesperrt. */
const activeProfileWhere = {
  status: "active" as const,
  type: { in: ["single" as const, "couple" as const] },
  memberships: { some: { status: "active" as const }, none: { status: "active" as const, user: { status: { not: "active" as const } } } },
};

export async function discoverProfiles(userId: string, profileId: string, f: DiscoverFilters = {}, limit = 60): Promise<DiscoverItem[]> {
  await assertMember(userId, profileId);
  const me = await db.communityProfile.findUniqueOrThrow({ where: { id: profileId }, include: { interests: { include: { interest: true } } } });
  const weights = await getSetting("matching.weights");
  const blocked = await blockedIds(profileId);
  const now = new Date();
  const year = now.getUTCFullYear();

  const candidates = await db.communityProfile.findMany({
    where: {
      ...activeProfileWhere,
      id: { notIn: [profileId, ...blocked] },
      ...(f.type ? { type: f.type } : {}),
      ...(f.verifiedOnly ? { verifiedBadge: true } : {}),
      ...(f.minAge ? { birthYearA: { lte: year - f.minAge } } : {}),
    },
    include: { interests: { include: { interest: true } } },
    orderBy: [{ lastActiveAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 400,
  });

  const connections = await db.connection.findMany({ where: { endedAt: null, OR: [{ aId: profileId }, { bId: profileId }] } });
  const connected = new Set(connections.map((c) => (c.aId === profileId ? c.bId : c.aId)));
  const favs = new Set((await db.favorite.findMany({ where: { ownerId: profileId }, select: { targetId: true } })).map((x) => x.targetId));
  const myInterests = new Map(me.interests.map((i) => [i.interest.slug, i.interest.label]));
  const myLooking = new Set(me.lookingFor);
  const out: DiscoverItem[] = [];

  for (const c of candidates) {
    const ages = agesOf(c, now);
    if (ages.some((a) => a < 18)) continue; // nur Volljährige
    if (f.minAge && ages.some((a) => a < f.minAge!)) continue;
    if (f.maxAge && ages.some((a) => a > f.maxAge!)) continue;

    const isConn = connected.has(c.id);
    const theirVisible = c.interests.filter((i) => i.interest.active && visibleInterest(i.visibility, me.verifiedBadge, isConn));
    if (f.interests?.length && !theirVisible.some((i) => f.interests!.includes(i.interest.slug))) continue;

    let km: number | null = null;
    if (me.lat != null && me.lng != null && c.lat != null && c.lng != null) km = haversineKm(me.lat, me.lng, c.lat, c.lng);
    if (f.maxDistanceKm && (km == null || km > f.maxDistanceKm)) continue;
    const bucket = km != null ? distanceBucket(km) : null;

    const shared = theirVisible.filter((i) => myInterests.has(i.interest.slug)).map((i) => i.interest.label);
    const sharedLooking = c.lookingFor.filter((x) => myLooking.has(x)).map(lookingForLabel);
    // Wer den Online-Status verbirgt, erscheint nicht als „kürzlich aktiv“
    const hidesActivity = !!(c.privacy as { invisibleOnline?: boolean } | null)?.invisibleOnline;
    const recentlyActive = !hidesActivity && !!c.lastActiveAt && now.getTime() - c.lastActiveAt.getTime() < 7 * 86400_000;

    const reasons: string[] = [];
    let rank = 0;
    if (shared.length) {
      reasons.push(`${shared.length} ${shared.length === 1 ? "gemeinsames Interesse" : "gemeinsame Interessen"}: ${shared.slice(0, 4).join(", ")}`);
      rank += weights.interests * shared.length;
    }
    if (sharedLooking.length) {
      reasons.push(`sucht ebenfalls: ${sharedLooking.join(", ")}`);
      rank += weights.lookingFor * sharedLooking.length;
    }
    if (bucket) {
      if (BUCKET_ORDER.indexOf(bucket) <= 3) reasons.push(`in deiner Nähe (${bucket})`);
      rank += weights.distance * ((BUCKET_ORDER.length - 1 - BUCKET_ORDER.indexOf(bucket)) / (BUCKET_ORDER.length - 1));
    } else if (c.regionName && c.regionName === me.regionName && c.regionCountry === me.regionCountry) {
      reasons.push(`gleiche Region: ${c.regionName}`);
      rank += weights.distance * 0.5;
    }
    if (recentlyActive) {
      reasons.push("aktiv in den letzten 7 Tagen");
      rank += weights.activity;
    }
    if (c.verifiedBadge) {
      reasons.push("verifiziert");
      rank += weights.verified;
    }

    out.push({
      id: c.id, handle: c.handle, type: c.type, ages, region: regionLabel(c), headline: c.headline, verified: c.verifiedBadge,
      distance: bucket, sharedInterests: shared, sharedLookingFor: sharedLooking, recentlyActive, reasons, rank, isFavorite: favs.has(c.id),
    });
  }
  out.sort((a, b) => b.rank - a.rank || a.handle.localeCompare(b.handle));
  return out.slice(0, limit);
}

/** Profildetail für das betrachtende Profil – nicht sichtbar bei Blockierung, inaktiven oder gelöschten Profilen. */
export async function getProfileForViewer(userId: string, viewerProfileId: string, handle: string) {
  await assertMember(userId, viewerProfileId);
  const p = await db.communityProfile.findFirst({
    where: { handle, ...activeProfileWhere, type: { in: ["single", "couple", "organizer"] } },
    include: {
      interests: { include: { interest: true } },
      memberships: { where: { status: "active" }, select: { displayLabel: true } },
    },
  });
  if (!p) throw notFound("Profil nicht gefunden.");
  if (p.id !== viewerProfileId && (await isBlockedEitherWay(viewerProfileId, p.id))) throw notFound("Profil nicht gefunden.");
  const viewer = await db.communityProfile.findUniqueOrThrow({ where: { id: viewerProfileId } });
  const isSelf = p.id === viewerProfileId;
  const connected = isSelf ? true : await areConnected(viewerProfileId, p.id);
  const [fav, pendingOut, pendingIn, conv] = isSelf
    ? [null, null, null, null]
    : await Promise.all([
        db.favorite.findUnique({ where: { ownerId_targetId: { ownerId: viewerProfileId, targetId: p.id } } }),
        db.contactRequest.findFirst({ where: { fromId: viewerProfileId, toId: p.id, status: "pending" } }),
        db.contactRequest.findFirst({ where: { fromId: p.id, toId: viewerProfileId, status: "pending" } }),
        db.conversation.findUnique({ where: { pairKey: viewerProfileId < p.id ? `${viewerProfileId}:${p.id}` : `${p.id}:${viewerProfileId}` } }),
      ]);
  return {
    id: p.id, handle: p.handle, type: p.type, ages: agesOf(p), region: regionLabel(p), headline: p.headline, about: p.about,
    relationshipForm: p.relationshipForm, lookingFor: p.lookingFor.map(lookingForLabel), verified: p.verifiedBadge,
    labels: p.memberships.map((m) => m.displayLabel).filter(Boolean) as string[],
    interests: p.interests.filter((i) => i.interest.active && (isSelf || visibleInterest(i.visibility, viewer.verifiedBadge, connected))).map((i) => i.interest.label),
    isSelf, connected, isFavorite: !!fav, pendingOutgoing: !!pendingOut, pendingIncomingId: pendingIn?.id ?? null,
    conversationId: conv?.id ?? null,
  };
}

/** Bildentdeckung: nächstes Profil, das noch nicht bewertet wurde. */
export async function nextImageCandidate(userId: string, profileId: string) {
  await assertMember(userId, profileId);
  const blocked = await blockedIds(profileId);
  const rated = await db.profileLike.findMany({ where: { fromId: profileId }, select: { toId: true } });
  const me = await db.communityProfile.findUniqueOrThrow({ where: { id: profileId } });
  const c = await db.communityProfile.findFirst({
    where: { ...activeProfileWhere, id: { notIn: [profileId, ...blocked, ...rated.map((r) => r.toId)] } },
    orderBy: [{ lastActiveAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  if (!c) return null;
  const connected = await areConnected(profileId, c.id);
  // nur freigegebene Profilbilder, die für die betrachtende Person sichtbar sind
  const images = await db.mediaAsset.findMany({
    where: {
      ownerId: c.id, purpose: "profile", moderation: "approved", deletedAt: null,
      visibility: { in: [...(me.verifiedBadge ? ["verified_members"] : []), ...(connected ? ["contacts", "verified_members"] : [])] },
    },
    select: { id: true },
    take: 4,
    orderBy: { createdAt: "asc" },
  });
  return { id: c.id, handle: c.handle, type: c.type, ages: agesOf(c), region: regionLabel(c), headline: c.headline, verified: c.verifiedBadge, imageIds: images.map((i) => i.id) };
}
