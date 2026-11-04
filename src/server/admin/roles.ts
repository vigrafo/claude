import { db } from "../db";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { ROLES } from "../rbac";
import { assertPerm, requireReason } from "./guard";
import { applyRoleGrant, createApproval } from "./approvals";

/**
 * Plattformrollen vergeben/entziehen. Kritische Rollen (ROLES[key].critical) nur per Vier-Augen-Freigabe.
 * Niemand ändert die eigenen Rollen.
 */
export async function requestRoleGrant(actorUserId: string, email: string, roleKey: string, reasonRaw: string) {
  await assertPerm(actorUserId, "roles.manage");
  const reason = requireReason(reasonRaw);
  const def = ROLES[roleKey];
  if (!def || def.permissions.length === 0) throw new AppError("role", "Diese Rolle ist keine Plattformrolle.");
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw notFound("Keine Person mit dieser E-Mail-Adresse.");
  if (user.id === actorUserId) throw forbidden("Eigene Rollen können nicht selbst geändert werden.");
  if (user.status !== "active") throw new AppError("inactive", "Konto ist nicht aktiv.");
  if (def.critical) {
    const open = await db.pendingApproval.findMany({ where: { kind: "role_grant", approvedBy: null, rejectedBy: null } });
    if (open.some((p) => (p.payload as { userId?: string; roleKey?: string }).userId === user.id && (p.payload as { roleKey?: string }).roleKey === roleKey)) {
      throw new AppError("pending", "Für diese Vergabe liegt bereits ein offener Antrag vor.");
    }
    const p = await createApproval("role_grant", { userId: user.id, roleKey, reason }, actorUserId);
    return { status: "pending" as const, approvalId: p.id };
  }
  await applyRoleGrant(user.id, roleKey, actorUserId, null);
  return { status: "granted" as const };
}

export async function revokeRole(actorUserId: string, assignmentId: string, reasonRaw: string) {
  await assertPerm(actorUserId, "roles.manage");
  const reason = requireReason(reasonRaw);
  const a = await db.roleAssignment.findUnique({ where: { id: assignmentId }, include: { role: true } });
  if (!a || a.revokedAt) throw notFound();
  if (a.userId === actorUserId) throw forbidden("Eigene Rollen können nicht selbst geändert werden.");
  if (a.role.key === "superadmin") {
    const remaining = await db.roleAssignment.count({ where: { role: { key: "superadmin" }, revokedAt: null, scopeType: null, id: { not: a.id } } });
    if (remaining === 0) throw new AppError("last_superadmin", "Der letzte Superadmin kann nicht entfernt werden.");
  }
  await db.roleAssignment.update({ where: { id: a.id }, data: { revokedAt: new Date() } });
  // laufende Adminsitzungen der Person beenden, damit entzogene Rechte sofort greifen
  await db.session.updateMany({ where: { userId: a.userId, isAdmin: true, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit("role.revoked", { actorUserId, targetType: "user", targetId: a.userId, meta: { role: a.role.key, reason } });
}

export async function revokeAdminSession(actorUserId: string, sessionId: string) {
  await assertPerm(actorUserId, "roles.manage");
  const s = await db.session.findUnique({ where: { id: sessionId } });
  if (!s || !s.isAdmin) throw notFound();
  await db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
  await audit("admin.session_revoked", { actorUserId, targetType: "session", targetId: s.id, meta: { user: s.userId } });
}
