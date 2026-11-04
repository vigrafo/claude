import { db } from "../db";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { hasPermission, ROLES } from "../rbac";
import { adminAdjustTokens } from "../tokens";
import { refreshBadgesForUser } from "../state";

/**
 * Vier-Augen-Freigaben (PendingApproval). Die beantragende Person kann NIE selbst freigeben.
 * Kinds: role_grant (kritische Rollen) | token_correction (> FOUR_EYES_TOKEN_THRESHOLD).
 */
export type ApprovalKind = "role_grant" | "token_correction";

export interface RoleGrantPayload { userId: string; roleKey: string; reason: string }
export interface TokenCorrectionPayload { profileId: string; delta: number; reason: string }

const PERM_FOR: Record<ApprovalKind, "roles.manage" | "tokens.manage"> = {
  role_grant: "roles.manage",
  token_correction: "tokens.manage",
};

export async function createApproval(kind: ApprovalKind, payload: RoleGrantPayload | TokenCorrectionPayload, requestedBy: string) {
  if (!(await hasPermission(requestedBy, PERM_FOR[kind]))) throw forbidden();
  const row = await db.pendingApproval.create({ data: { kind, payload: payload as object, requestedBy } });
  await audit("approval.requested", { actorUserId: requestedBy, targetType: "approval", targetId: row.id, meta: { kind } });
  return row;
}

async function claim(id: string, approver: string, decision: "approve" | "reject") {
  const p = await db.pendingApproval.findUnique({ where: { id } });
  if (!p) throw notFound();
  const kind = p.kind as ApprovalKind;
  if (!PERM_FOR[kind]) throw new AppError("kind", "Unbekannte Freigabeart.");
  if (!(await hasPermission(approver, PERM_FOR[kind]))) throw forbidden();
  if (p.requestedBy === approver) throw forbidden("Eigene Anträge können nicht selbst freigegeben werden (Vier-Augen-Prinzip).");
  const upd = await db.pendingApproval.updateMany({
    where: { id, approvedBy: null, rejectedBy: null },
    data: decision === "approve" ? { approvedBy: approver, decidedAt: new Date() } : { rejectedBy: approver, decidedAt: new Date() },
  });
  if (upd.count !== 1) throw new AppError("decided", "Dieser Antrag ist bereits entschieden.");
  return p;
}

export async function approvePending(id: string, approver: string) {
  const p = await claim(id, approver, "approve");
  try {
    if (p.kind === "role_grant") {
      const pl = p.payload as unknown as RoleGrantPayload;
      await applyRoleGrant(pl.userId, pl.roleKey, p.requestedBy, approver);
    } else if (p.kind === "token_correction") {
      const pl = p.payload as unknown as TokenCorrectionPayload;
      await adminAdjustTokens({
        profileId: pl.profileId, delta: pl.delta, reason: pl.reason, actorUserId: p.requestedBy, approvedBy: approver, idemKey: `approval:${p.id}`,
      });
    }
  } catch (e) {
    // Ausführung fehlgeschlagen → Freigabe zurücksetzen, damit der Antrag nicht als erledigt gilt
    await db.pendingApproval.update({ where: { id }, data: { approvedBy: null, decidedAt: null } });
    throw e;
  }
  await audit("approval.approved", { actorUserId: approver, targetType: "approval", targetId: id, meta: { kind: p.kind, requestedBy: p.requestedBy } });
}

export async function rejectPending(id: string, approver: string) {
  const p = await claim(id, approver, "reject");
  await audit("approval.rejected", { actorUserId: approver, targetType: "approval", targetId: id, meta: { kind: p.kind } });
}

/** Führt eine Plattform-Rollenvergabe aus (ohne Rechteprüfung – nur intern nach Prüfung/Freigabe). */
export async function applyRoleGrant(userId: string, roleKey: string, grantedBy: string, approvedBy: string | null) {
  if (!ROLES[roleKey]) throw new AppError("role", "Unbekannte Rolle.");
  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new AppError("role_missing", "Rolle nicht synchronisiert (syncRbac ausführen).");
  const existing = await db.roleAssignment.findFirst({ where: { userId, roleId: role.id, scopeType: null, revokedAt: null } });
  if (existing) throw new AppError("exists", "Die Person hat diese Rolle bereits.");
  const a = await db.roleAssignment.create({ data: { userId, roleId: role.id, grantedBy, approvedBy } });
  await refreshBadgesForUser(userId).catch(() => undefined);
  await audit("role.granted", { actorUserId: approvedBy ?? grantedBy, targetType: "user", targetId: userId, meta: { role: roleKey, grantedBy, approvedBy } });
  return a;
}
