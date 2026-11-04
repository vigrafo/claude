import { db } from "./db";
import { forbidden } from "./errors";
import { can } from "@/domain/access";
import { assertMember } from "./contacts";
import { areConnected, isBlockedEitherWay, personState, profileState } from "./state";

/**
 * Medienfreigabe mit Rechteprüfung. Ausgeliefert werden nur moderierte (approved), nicht gelöschte
 * Medien. Gruppenmedien nur für aktive Gruppenmitglieder mit Gruppengalerie-Recht.
 */
export async function canViewMedia(userId: string, profileId: string, mediaId: string) {
  await assertMember(userId, profileId);
  const m = await db.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!m || m.deletedAt) return null;
  if (m.ownerId === profileId) return m;
  if (m.moderation !== "approved") return null;
  if (await isBlockedEitherWay(profileId, m.ownerId)) return null;
  const owner = await db.communityProfile.findUnique({ where: { id: m.ownerId } });
  if (!owner || owner.status !== "active") return null;
  switch (m.visibility) {
    case "private":
      return null;
    case "contacts":
      return (await areConnected(profileId, m.ownerId)) ? m : null;
    case "verified_members": {
      const me = await db.communityProfile.findUnique({ where: { id: profileId } });
      return me?.verifiedBadge || (await areConnected(profileId, m.ownerId)) ? m : null;
    }
    case "group": {
      if (!m.scopeId) return null;
      return (await groupGalleryAllowed(userId, profileId, m.scopeId)) ? m : null;
    }
    default:
      return null;
  }
}

export async function groupGalleryAllowed(userId: string, profileId: string, groupId: string): Promise<boolean> {
  const actor = await personState(userId);
  const prof = await profileState(profileId);
  if (!actor || !prof || !can("group_gallery", actor, prof).allowed) return false;
  const gm = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId, profileId } } });
  const g = await db.group.findUnique({ where: { id: groupId } });
  return gm?.status === "active" && g?.status === "approved";
}

export async function listGroupGallery(userId: string, profileId: string, groupId: string) {
  await assertMember(userId, profileId);
  if (!(await groupGalleryAllowed(userId, profileId, groupId))) throw forbidden("Gruppengalerie nicht verfügbar.");
  const blocks = await db.block.findMany({ where: { OR: [{ blockerId: profileId }, { blockedId: profileId }] } });
  const hidden = blocks.map((b) => (b.blockerId === profileId ? b.blockedId : b.blockerId));
  return db.mediaAsset.findMany({
    where: { purpose: "group", scopeId: groupId, moderation: "approved", deletedAt: null, ownerId: { notIn: hidden } },
    include: { owner: { select: { handle: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}
