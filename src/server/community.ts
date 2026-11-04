import { db, isUniqueViolation } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { can } from "@/domain/access";
import { personState, profileState } from "./state";
import { audit } from "./audit";
import { hasPermission, isGroupModerator } from "./rbac";
import { enqueue } from "./outbox";

export async function requireCommunity(userId: string, profileId: string) {
  const actor = await personState(userId);
  const prof = await profileState(profileId);
  if (!actor || !prof) throw forbidden();
  const c = can("community", actor, prof);
  if (!c.allowed) throw forbidden(c.reason);
  return { actor, prof };
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// ───────────── Gruppen ─────────────

export async function applyForGroup(userId: string, profileId: string, g: {
  name: string; description: string; category: string; visibility: "open" | "closed" | "invite"; rules?: string;
  regionCountry?: string; regionName?: string; proposedModerators?: string[];
}) {
  await requireCommunity(userId, profileId);
  if (g.name.trim().length < 3 || g.description.trim().length < 20) throw new AppError("invalid", "Bitte Name (mind. 3) und Beschreibung (mind. 20 Zeichen) angeben.");
  const slug = `${slugify(g.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const group = await db.group.create({
    data: {
      slug, name: g.name.trim(), description: g.description.trim(), category: g.category, visibility: g.visibility, rules: g.rules,
      regionCountry: g.regionCountry, regionName: g.regionName, status: "pending_approval", createdById: userId,
      applications: { create: { applicantUserId: userId, profileId, proposedModerators: g.proposedModerators ?? [] } },
      forumCategories: { create: { slug: `${slug}-forum`, name: "Diskussion" } },
    },
  });
  await enqueue(db, "admin.notify", { kind: "group_application", summary: "Neuer Gruppenantrag", link: `/admin/gruppen/${group.id}` });
  await audit("group.applied", { actorUserId: userId, targetType: "group", targetId: group.id });
  return group;
}

/** Nur die eropub-Administration entscheidet über Freigabe/Ablehnung/Sperre/Archivierung. */
export async function decideGroup(adminUserId: string, groupId: string, status: "approved" | "rejected" | "suspended" | "archived", note?: string) {
  if (!(await hasPermission(adminUserId, "groups.manage"))) throw forbidden();
  const g = await db.group.update({ where: { id: groupId }, data: { status, decidedById: adminUserId, decisionNote: note } });
  await db.groupApplication.updateMany({ where: { groupId, status: "pending" }, data: { status: status === "approved" ? "approved" : "rejected", decidedAt: new Date() } });
  if (status === "approved") {
    const app = await db.groupApplication.findFirst({ where: { groupId } });
    if (app) await db.groupMembership.upsert({ where: { groupId_profileId: { groupId, profileId: app.profileId } }, create: { groupId, profileId: app.profileId }, update: { status: "active" } });
  }
  await audit(`group.${status}`, { actorUserId: adminUserId, targetType: "group", targetId: groupId, meta: { note: note ?? null } });
  return g;
}

/** Sichtbar sind nur freigegebene Gruppen. Einladungsgruppen nur für Mitglieder. */
export async function listVisibleGroups(profileId: string) {
  const mine = await db.groupMembership.findMany({ where: { profileId, status: "active" }, select: { groupId: true } });
  return db.group.findMany({
    where: { status: "approved", OR: [{ visibility: { in: ["open", "closed"] } }, { id: { in: mine.map((m) => m.groupId) } }] },
    orderBy: [{ official: "desc" }, { name: "asc" }],
    include: { _count: { select: { memberships: { where: { status: "active" } } } } },
  });
}

export async function getVisibleGroup(profileId: string, slugOrId: string) {
  const g = await db.group.findFirst({ where: { OR: [{ slug: slugOrId }, { id: slugOrId }] } });
  if (!g || g.status !== "approved") throw notFound();
  const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId: g.id, profileId } } });
  if (g.visibility === "invite" && m?.status !== "active") throw notFound();
  return { group: g, membership: m };
}

export async function joinGroup(userId: string, profileId: string, groupId: string) {
  await requireCommunity(userId, profileId);
  const g = await db.group.findUnique({ where: { id: groupId } });
  if (!g || g.status !== "approved") throw notFound();
  if (g.visibility === "invite") throw forbidden("Diese Gruppe ist nur auf Einladung zugänglich.");
  const status = g.visibility === "open" ? "active" : "pending";
  await db.groupMembership.upsert({ where: { groupId_profileId: { groupId, profileId } }, create: { groupId, profileId, status }, update: { status } });
  return status;
}

export async function canWriteInGroup(userId: string, profileId: string, groupId: string): Promise<boolean> {
  const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId, profileId } } });
  if (!m || m.status !== "active" || !m.canWrite) return false;
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  return !!member;
}

/** Lokale Moderation: nur im eigenen Bereich, ohne Plattformrechte. */
export async function moderateGroupMember(userId: string, groupId: string, targetProfileId: string, action: "approve" | "remove" | "mute" | "unmute") {
  const isMod = (await isGroupModerator(userId, groupId)) || (await hasPermission(userId, "groups.manage"));
  if (!isMod) throw forbidden();
  const data =
    action === "approve" ? { status: "active" } : action === "remove" ? { status: "removed" } : action === "mute" ? { canWrite: false } : { canWrite: true };
  await db.groupMembership.update({ where: { groupId_profileId: { groupId, profileId: targetProfileId } }, data });
  await audit(`group.member_${action}`, { actorUserId: userId, targetType: "group", targetId: groupId, meta: { profile: targetProfileId } });
}

/** Moderator-Bewerbung: persönlich, je Gruppe, keine doppelten offenen Bewerbungen. */
export async function applyAsModerator(userId: string, profileId: string, groupId: string, motivation: string) {
  await requireCommunity(userId, profileId);
  const g = await db.group.findUnique({ where: { id: groupId } });
  if (!g || g.status !== "approved") throw notFound();
  const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId, profileId } } });
  if (m?.status !== "active") throw forbidden("Nur aktive Gruppenmitglieder können sich bewerben.");
  if (motivation.trim().length < 30) throw new AppError("motivation", "Bitte beschreibe deine Motivation (mind. 30 Zeichen).");
  if (await isGroupModerator(userId, groupId)) throw new AppError("already", "Du moderierst diese Gruppe bereits.");
  try {
    return await db.groupModeratorApplication.create({ data: { groupId, userId, motivation: motivation.trim().slice(0, 2000), openKey: `${groupId}:${userId}` } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("duplicate", "Du hast bereits eine offene Bewerbung für diese Gruppe.");
    throw e;
  }
}

/** Nur eropub-Administration ernennt/entzieht. Rolle gilt nur für die Person und diese Gruppe. */
export async function decideModeratorApplication(adminUserId: string, applicationId: string, approve: boolean) {
  if (!(await hasPermission(adminUserId, "groups.manage"))) throw forbidden();
  const app = await db.groupModeratorApplication.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.status !== "pending") throw new AppError("closed", "Bewerbung ist bereits entschieden.");
  await db.$transaction(async (tx) => {
    await tx.groupModeratorApplication.update({
      where: { id: app.id }, data: { status: approve ? "approved" : "rejected", openKey: null, decidedAt: new Date(), decidedById: adminUserId },
    });
    if (approve) {
      const role = await tx.role.findUniqueOrThrow({ where: { key: "group_moderator" } });
      await tx.roleAssignment.create({ data: { userId: app.userId, roleId: role.id, scopeType: "group", scopeId: app.groupId, grantedBy: adminUserId } });
    }
  });
  await audit(approve ? "group.moderator_appointed" : "group.moderator_rejected", { actorUserId: adminUserId, targetType: "group", targetId: app.groupId, meta: { user: app.userId } });
}

export async function revokeModerator(adminUserId: string, groupId: string, userId: string) {
  if (!(await hasPermission(adminUserId, "groups.manage"))) throw forbidden();
  await db.roleAssignment.updateMany({ where: { userId, scopeType: "group", scopeId: groupId, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit("group.moderator_revoked", { actorUserId: adminUserId, targetType: "group", targetId: groupId, meta: { user: userId } });
}

// ───────────── Foren ─────────────

async function threadAccess(userId: string, profileId: string, categoryId: string) {
  const cat = await db.forumCategory.findUnique({ where: { id: categoryId }, include: { group: true } });
  if (!cat) throw notFound();
  if (cat.group) {
    if (cat.group.status !== "approved") throw notFound();
    const m = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId: cat.group.id, profileId } } });
    const active = m?.status === "active";
    if (cat.group.visibility !== "open" && !active) throw forbidden("Nur für Gruppenmitglieder.");
    return { cat, canWrite: active && !!m?.canWrite && (await canWriteInGroup(userId, profileId, cat.group.id)) };
  }
  return { cat, canWrite: true };
}

export async function createThread(userId: string, profileId: string, categoryId: string, title: string, body: string) {
  await requireCommunity(userId, profileId);
  const { canWrite } = await threadAccess(userId, profileId, categoryId);
  if (!canWrite) throw forbidden("Keine Schreibfreigabe.");
  if (title.trim().length < 4 || body.trim().length < 2) throw new AppError("invalid", "Titel und Text angeben.");
  return db.thread.create({
    data: { categoryId, authorId: profileId, title: title.trim().slice(0, 160), posts: { create: { authorId: profileId, authorUserId: userId, body: body.slice(0, 10000) } } },
  });
}

export async function replyToThread(userId: string, profileId: string, threadId: string, body: string, quoteId?: string) {
  await requireCommunity(userId, profileId);
  const t = await db.thread.findUnique({ where: { id: threadId } });
  if (!t) throw notFound();
  if (t.locked) throw forbidden("Dieses Thema ist geschlossen.");
  const { canWrite } = await threadAccess(userId, profileId, t.categoryId);
  if (!canWrite) throw forbidden("Keine Schreibfreigabe.");
  if (!body.trim()) throw new AppError("invalid", "Bitte Text eingeben.");
  const p = await db.post.create({ data: { threadId, authorId: profileId, authorUserId: userId, body: body.slice(0, 10000), quoteId } });
  await db.thread.update({ where: { id: threadId }, data: { lastPostAt: new Date() } });
  return p;
}

export async function editPost(userId: string, profileId: string, postId: string, body: string) {
  const p = await db.post.findUnique({ where: { id: postId } });
  if (!p || p.authorId !== profileId || p.authorUserId !== userId) throw forbidden();
  await db.$transaction([
    db.postRevision.create({ data: { postId, body: p.body, editedBy: userId } }),
    db.post.update({ where: { id: postId }, data: { body: body.slice(0, 10000), editedAt: new Date() } }),
  ]);
}

export async function listThreads(userId: string, profileId: string, categoryId: string) {
  await requireCommunity(userId, profileId);
  await threadAccess(userId, profileId, categoryId);
  return db.thread.findMany({ where: { categoryId }, orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }], include: { author: { select: { handle: true } }, _count: { select: { posts: true } } } });
}
