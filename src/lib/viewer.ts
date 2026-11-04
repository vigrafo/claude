import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { sessionFromToken } from "@/server/auth";
import { personState, profileState } from "@/server/state";
import { can, profileVerified, type Capability } from "@/domain/access";
import { permissionsOf, type PermissionKey } from "@/server/rbac";

export const SESSION_COOKIE = "ep_session";
export const ADMIN_COOKIE = "ep_admin";

export async function setSessionCookie(name: string, token: string, maxAgeSec: number) {
  const c = await cookies();
  c.set(name, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.APP_ENV === "production", path: "/", maxAge: maxAgeSec,
  });
}

export async function clearCookie(name: string) {
  (await cookies()).delete(name);
}

export const getViewer = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await sessionFromToken(token);
  if (!session) return null;
  const person = await personState(session.userId);
  if (!person) return null;
  const memberships = await db.profileMembership.findMany({
    where: { userId: session.userId, status: "active" },
    include: { profile: true },
    orderBy: { createdAt: "asc" },
  });
  const active = memberships.find((m) => m.profileId === session.activeProfileId) ?? memberships[0] ?? null;
  const profile = active ? await profileState(active.profileId) : null;
  return {
    session,
    user: session.user,
    person,
    memberships,
    profileRow: active?.profile ?? null,
    profile,
    verified: profile ? profileVerified(profile) : false,
    can: (cap: Capability) => (profile ? can(cap, person, profile) : { allowed: false, reason: "Kein Profil." }),
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/anmelden");
  if (!v.user.emailVerifiedAt) redirect("/anmelden/bestaetigen");
  return v;
}

export async function requireProfile() {
  const v = await requireViewer();
  if (!v.profile || !v.profileRow) redirect("/app/profil/neu");
  return v as Viewer & { profile: NonNullable<Viewer["profile"]>; profileRow: NonNullable<Viewer["profileRow"]> };
}

/** Adminsitzung: eigenes Cookie, MFA-Pflicht, kurze Laufzeit. */
export const getAdmin = cache(async () => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = await sessionFromToken(token);
  if (!session || !session.isAdmin || !session.mfaAt) return null;
  const perms = await permissionsOf(session.userId);
  if (!perms.has("admin.access")) return null;
  return { session, user: session.user, perms, has: (p: PermissionKey) => perms.has(p) };
});

export type AdminViewer = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;

export async function requireAdmin(p?: PermissionKey): Promise<AdminViewer> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (p && !a.perms.has(p)) redirect("/admin?forbidden=1");
  return a;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "0.0.0.0").trim();
}
