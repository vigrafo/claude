"use server";
import { validateHandle } from "@/server/profiles";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { bool, int, run, str, type ActionState } from "@/lib/actions";
import { actingProfile, actingUser } from "@/app/app/_lib/server";
import { acceptPartnerInvite, invitePartner, leaveCouple, requestDeletion, updateProfile } from "@/server/profiles";
import { db, isUniqueViolation } from "@/server/db";
import { AppError, forbidden } from "@/server/errors";
import { audit } from "@/server/audit";
import { isAllowedCountry } from "@/domain/countries";
import { LOOKING_FOR, RELATIONSHIP_FORMS } from "@/app/app/_lib/options";
import { SESSION_COOKIE, clearCookie } from "@/lib/viewer";
import { rateLimit } from "@/server/ratelimit";


function optAge(fd: FormData, k: string): number | undefined {
  const n = int(fd, k);
  if (!Number.isFinite(n)) return undefined;
  if (n < 18 || n > 110) throw new AppError("age", "Alter im Kontaktfilter: 18 bis 110.");
  return n;
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId, v } = await actingProfile();
    const about = typeof fd.get("about") === "string" ? (fd.get("about") as string).trim() : "";
    if ([...about].length > 2000) throw new AppError("about", `Über dich: höchstens 2000 Zeichen (aktuell ${[...about].length}).`);
    const headline = str(fd, "headline");
    if ([...headline].length > 120) throw new AppError("headline", "Überschrift: höchstens 120 Zeichen.");
    const rel = str(fd, "relationshipForm");
    if (!RELATIONSHIP_FORMS.some((r) => r.key === rel)) throw new AppError("rel", "Ungültige Beziehungsform.");
    const lookingFor = fd.getAll("lookingFor").map(String).filter((x) => LOOKING_FOR.some((l) => l.key === x));
    const interestSlugs = fd.getAll("interests").map(String).slice(0, 30);
    const country = str(fd, "country").toUpperCase();
    if (!isAllowedCountry(country)) throw new AppError("country", "Bitte wähle ein unterstütztes Land.");
    const postal = str(fd, "postal").replace(/\s/g, "");
    if (postal && !/^[A-Za-z0-9]{2,10}$/.test(postal)) throw new AppError("postal", "Ungültige Postleitzahl.");
    const allowTypes = fd.getAll("allowTypes").map(String).filter((t) => t === "single" || t === "couple" || t === "organizer");
    const minAge = optAge(fd, "minAge");
    const maxAge = optAge(fd, "maxAge");
    if (minAge && maxAge && minAge > maxAge) throw new AppError("age", "Mindestalter darf nicht über dem Höchstalter liegen.");

    await updateProfile(userId, profileId, {
      headline, about, relationshipForm: rel, regionCountry: country, regionName: str(fd, "regionName"), regionCity: str(fd, "regionCity"),
      postalPrefix: postal, lookingFor, interestSlugs,
      contactFilter: { allowTypes, verifiedOnly: bool(fd, "verifiedOnly"), ...(minAge ? { minAge } : {}), ...(maxAge ? { maxAge } : {}) },
      privacy: {
        invisibleOnline: bool(fd, "invisibleOnline"), readReceipts: bool(fd, "readReceipts"),
        neutralNotifications: bool(fd, "neutralNotifications"), discreetMode: bool(fd, "discreetMode"),
      },
    });

    // Eigenes Geburtsjahr: einmalig setzbar (Paar: jede Person für sich), danach nur über den Support.
    const by = int(fd, "birthYear");
    if (Number.isFinite(by)) {
      const year = new Date().getUTCFullYear();
      if (year - by < 18 || year - by > 110) throw new AppError("adult", "eropub ist ausschließlich für Personen ab 18 Jahren.");
      const m = v.memberships.find((x) => x.profileId === profileId)!;
      const field = m.role === "partner" ? "birthYearB" : "birthYearA";
      if (v.profileRow[field] == null) await db.communityProfile.update({ where: { id: profileId }, data: { [field]: by } });
    }
    revalidatePath("/app", "layout");
    return { ok: true, message: "Dein Profil wurde gespeichert." };
  });
}

/** Neues Profil für Personen ohne aktives Profil (z. B. nach Paartrennung). */
export async function createProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, v } = await actingUser();
    if (v.memberships.length > 0) throw new AppError("exists", "Du hast bereits ein aktives Profil.");
    const handle = str(fd, "handle");
    validateHandle(handle);
    const type = str(fd, "profileType") === "couple" ? "couple" : "single";
    const by = int(fd, "birthYear");
    const year = new Date().getUTCFullYear();
    if (!by || year - by < 18 || year - by > 110) throw new AppError("adult", "eropub ist ausschließlich für Personen ab 18 Jahren.");
    const country = str(fd, "country").toUpperCase();
    if (!isAllowedCountry(country)) throw new AppError("country", "Bitte wähle ein unterstütztes Land.");
    try {
      const p = await db.communityProfile.create({
        data: {
          handle, type, regionCountry: country, birthYearA: by, status: type === "couple" ? "pending_partner" : "active",
          memberships: { create: { userId, role: "owner", confirmedAt: new Date() } },
        },
      });
      await db.session.update({ where: { id: v.session.id }, data: { activeProfileId: p.id } });
      const { refreshProfileBadge } = await import("@/server/state");
      await refreshProfileBadge(p.id);
      await audit("profile.created", { actorUserId: userId, targetType: "profile", targetId: p.id });
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("handle", "Dieses Pseudonym ist bereits vergeben.");
      throw e;
    }
    redirect(type === "couple" ? "/app/profil/paar" : "/app/profil/bearbeiten");
  });
}

export async function switchProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { v } = await actingUser();
    const target = str(fd, "profileId");
    if (!v.memberships.some((m) => m.profileId === target)) throw forbidden();
    await db.session.update({ where: { id: v.session.id }, data: { activeProfileId: target } });
    revalidatePath("/app", "layout");
    return { ok: true, message: "Aktives Profil gewechselt." };
  });
}

export async function invitePartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId, v } = await actingProfile();
    const email = str(fd, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("email", "Bitte gib eine gültige E-Mail-Adresse ein.");
    if (email === v.user.email) throw new AppError("email", "Bitte lade die E-Mail-Adresse deiner Partnerperson ein.");
    await rateLimit("couple_invite", userId, 5, 3600);
    await invitePartner(userId, profileId, email);
    revalidatePath("/app/profil/paar");
    return { ok: true, message: "Einladung gesendet. Der Link ist 7 Tage gültig." };
  });
}

export async function leaveCoupleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    if (str(fd, "confirm") !== "TRENNEN") throw new AppError("confirm", "Bitte bestätige mit dem Wort TRENNEN.");
    await leaveCouple(userId, profileId, { convertRemainingToSingle: bool(fd, "convert") });
    redirect("/app/profil");
  });
}

/** Wandelt ein Paarprofil ohne Partnerperson in ein Einzelprofil um. */
export async function convertToSingleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId, v } = await actingProfile();
    if (v.profileRow.type !== "couple") throw new AppError("type", "Nur für Paarprofile.");
    if (str(fd, "confirm") !== "EINZEL") throw new AppError("confirm", "Bitte bestätige mit dem Wort EINZEL.");
    const active = await db.profileMembership.count({ where: { profileId, status: "active" } });
    if (active !== 1) throw new AppError("partner", "Solange zwei Personen verknüpft sind, nutze „Paar verlassen“.");
    await db.$transaction([
      db.communityProfile.update({ where: { id: profileId }, data: { type: "single", status: "active", birthYearB: null } }),
      db.coupleInvite.updateMany({ where: { profileId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    const { refreshProfileBadge } = await import("@/server/state");
    await refreshProfileBadge(profileId);
    await audit("couple.converted_single", { actorUserId: userId, targetType: "profile", targetId: profileId });
    redirect("/app/profil");
  });
}

export async function acceptPartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, v } = await actingUser();
    const label = str(fd, "displayLabel").slice(0, 20) || undefined;
    await acceptPartnerInvite(userId, str(fd, "token"), label);
    const inv = await db.profileMembership.findFirst({ where: { userId, status: "active", role: "partner" }, orderBy: { createdAt: "desc" } });
    if (inv) await db.session.update({ where: { id: v.session.id }, data: { activeProfileId: inv.profileId } });
    redirect("/app/profil");
  });
}

export async function requestDeletionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    if (str(fd, "confirm") !== "LÖSCHEN") throw new AppError("confirm", "Bitte bestätige mit dem Wort LÖSCHEN.");
    await requestDeletion(userId);
    await clearCookie(SESSION_COOKIE);
    redirect("/?geloescht=1");
  });
}
