import { db, isUniqueViolation } from "./db";
import { AppError, forbidden } from "./errors";
import { hashPassword, validatePassword, createEmailToken, revokeAllSessions } from "./auth";
import { audit } from "./audit";
import { randomToken, sha256 } from "./crypto";
import { refreshProfileBadge } from "./state";
import { onRightsRevoked } from "./safety";
import { isAllowedCountry } from "@/domain/countries";
import { roundCoord } from "@/domain/geo";
import { sendMail } from "./mail";

const HANDLE_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
/** Pseudonyme, die mit festen Routen kollidieren würden oder irreführend sind. */
export const RESERVED_HANDLES = new Set(["bearbeiten", "neu", "paar", "datenschutz", "sicherheit", "admin", "eropub", "support", "verwaltung", "moderation", "system"]);

export function validateHandle(handle: string) {
  if (!HANDLE_RE.test(handle)) throw new AppError("handle", "Pseudonym: 3–24 Zeichen, Buchstaben, Ziffern, . _ -");
  if (RESERVED_HANDLES.has(handle.toLowerCase())) throw new AppError("handle", "Dieses Pseudonym ist reserviert. Bitte wähle ein anderes.");
}

export interface RegisterInput {
  email: string;
  password: string;
  handle: string;
  profileType: "single" | "couple";
  birthYear: number;
  adultConfirmed: boolean;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  country: string;
}

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("email", "Bitte gib eine gültige E-Mail-Adresse ein.");
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new AppError("password", pwErr);
  validateHandle(input.handle);
  if (!input.adultConfirmed) throw new AppError("adult", "eropub ist ausschließlich für Personen ab 18 Jahren.");
  const year = new Date().getUTCFullYear();
  if (!input.birthYear || year - input.birthYear < 18 || year - input.birthYear > 110) throw new AppError("adult", "eropub ist ausschließlich für Personen ab 18 Jahren.");
  if (!input.acceptTerms || !input.acceptPrivacy) throw new AppError("consent", "Bitte stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.");
  if (!isAllowedCountry(input.country)) throw new AppError("country", "Bitte wähle ein unterstütztes Land.");

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, passwordHash, adultConfirmedAt: new Date() } });
      await tx.consentRecord.createMany({
        data: [
          { userId: u.id, kind: "terms", version: "2026-11" },
          { userId: u.id, kind: "privacy", version: "2026-11" },
          { userId: u.id, kind: "adult_self_declaration", version: "2026-11" },
        ],
      });
      await tx.communityProfile.create({
        data: {
          handle: input.handle, type: input.profileType, regionCountry: input.country.toUpperCase(),
          status: input.profileType === "couple" ? "pending_partner" : "active",
          birthYearA: input.birthYear,
          memberships: { create: { userId: u.id, role: "owner", confirmedAt: new Date() } },
        },
      });
      return u;
    });
    const token = await createEmailToken(user.id, "verify_email", 48);
    await sendMail("verify_email", email, { link: `${process.env.APP_URL}/anmelden/bestaetigen?token=${token}` });
    await audit("user.registered", { actorUserId: user.id, targetType: "user", targetId: user.id });
    return { user, emailToken: token };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("exists", "E-Mail oder Pseudonym ist bereits vergeben.");
    throw e;
  }
}

/** Paarprofil: Partner:in wird per E-Mail eingeladen und legt einen EIGENEN Login an (keine geteilten Passwörter). */
export async function invitePartner(userId: string, profileId: string, email: string) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" }, include: { profile: true } });
  if (!m || m.profile.type !== "couple") throw forbidden();
  const count = await db.profileMembership.count({ where: { profileId, status: "active" } });
  if (count >= 2) throw new AppError("full", "Das Paarprofil hat bereits zwei Personen.");
  const token = randomToken(24);
  await db.coupleInvite.updateMany({ where: { profileId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.coupleInvite.create({
    data: { profileId, invitedBy: userId, email: email.trim().toLowerCase(), tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });
  await sendMail("couple_invite", email, { link: `${process.env.APP_URL}/paar/beitreten?token=${token}` });
  await audit("couple.invited", { actorUserId: userId, targetType: "profile", targetId: profileId });
  return token;
}

/** Beitritt durch die eingeladene Person mit eigenem, bereits angemeldetem Konto. Beide bestätigen damit die Verknüpfung. */
export async function acceptPartnerInvite(userId: string, token: string, displayLabel?: string) {
  const inv = await db.coupleInvite.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) throw new AppError("invalid", "Einladung ungültig oder abgelaufen.");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.email !== inv.email) throw forbidden("Diese Einladung gilt für eine andere E-Mail-Adresse.");
  if (inv.invitedBy === userId) throw forbidden();
  await db.$transaction(async (tx) => {
    const count = await tx.profileMembership.count({ where: { profileId: inv.profileId, status: "active" } });
    if (count >= 2) throw new AppError("full", "Das Paarprofil ist bereits vollständig.");
    await tx.profileMembership.upsert({
      where: { profileId_userId: { profileId: inv.profileId, userId } },
      create: { profileId: inv.profileId, userId, role: "partner", confirmedAt: new Date(), displayLabel },
      update: { status: "active", confirmedAt: new Date(), endedAt: null, displayLabel },
    });
    await tx.coupleInvite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    await tx.communityProfile.update({ where: { id: inv.profileId }, data: { status: "active" } });
  });
  await refreshProfileBadge(inv.profileId);
  await audit("couple.joined", { actorUserId: userId, targetType: "profile", targetId: inv.profileId });
}

/**
 * Trennung/Entfernung: die verbleibende Person behält das Profil als „pending_partner“
 * (oder wandelt in ein Einzelprofil um), Sitzungen der austretenden Person auf das Profil werden widerrufen,
 * Rechte neu bewertet, laufende Spiele/Anrufe beendet.
 */
export async function leaveCouple(userId: string, profileId: string, opts: { convertRemainingToSingle?: boolean } = {}) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" }, include: { profile: true } });
  if (!m || m.profile.type !== "couple") throw forbidden();
  await db.$transaction(async (tx) => {
    await tx.profileMembership.update({ where: { id: m.id }, data: { status: "removed", endedAt: new Date() } });
    const remaining = await tx.profileMembership.count({ where: { profileId, status: "active" } });
    await tx.communityProfile.update({
      where: { id: profileId },
      data: remaining === 0
        ? { status: "dissolved" }
        : opts.convertRemainingToSingle ? { type: "single", status: "active", birthYearB: null } : { status: "pending_partner" },
    });
    await tx.session.updateMany({ where: { userId, activeProfileId: profileId, revokedAt: null }, data: { activeProfileId: null } });
  });
  await refreshProfileBadge(profileId);
  await onRightsRevoked(userId, "couple_left");
  await audit("couple.left", { actorUserId: userId, targetType: "profile", targetId: profileId, meta: { convert: !!opts.convertRemainingToSingle } });
}

export interface ProfileUpdate {
  headline?: string; about?: string; relationshipForm?: string; regionCountry?: string; regionName?: string; regionCity?: string;
  postalPrefix?: string; lat?: number; lng?: number; lookingFor?: string[]; interestSlugs?: string[];
  contactFilter?: Record<string, unknown>; privacy?: Record<string, unknown>;
}

export async function updateProfile(userId: string, profileId: string, u: ProfileUpdate) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!m) throw forbidden();
  if (u.regionCountry && !isAllowedCountry(u.regionCountry)) throw new AppError("country", "Land nicht unterstützt.");
  if (u.about && u.about.length > 2000) throw new AppError("about", "Höchstens 2000 Zeichen.");
  await db.$transaction(async (tx) => {
    await tx.communityProfile.update({
      where: { id: profileId },
      data: {
        headline: u.headline?.slice(0, 120), about: u.about, relationshipForm: u.relationshipForm,
        regionCountry: u.regionCountry?.toUpperCase(), regionName: u.regionName?.slice(0, 80), regionCity: u.regionCity?.slice(0, 80),
        postalPrefix: u.postalPrefix?.replace(/\s/g, "").slice(0, 2),
        lat: u.lat != null ? roundCoord(u.lat) : undefined, lng: u.lng != null ? roundCoord(u.lng) : undefined,
        lookingFor: u.lookingFor, contactFilter: u.contactFilter as object | undefined, privacy: u.privacy as object | undefined,
      },
    });
    if (u.interestSlugs) {
      const ints = await tx.interest.findMany({ where: { slug: { in: u.interestSlugs }, active: true } });
      await tx.profileInterest.deleteMany({ where: { profileId } });
      if (ints.length) await tx.profileInterest.createMany({ data: ints.map((i) => ({ profileId, interestId: i.id })) });
    }
  });
}

/** Kontolöschung: Profil sofort unsichtbar, Löschlauf durch Worker nach Karenzzeit. Nur für das eigene Konto. */
export async function requestDeletion(userId: string) {
  const at = new Date(Date.now() + 7 * 86400_000);
  await db.deletionRequest.create({ data: { userId, scheduledFor: at } });
  const ms = await db.profileMembership.findMany({ where: { userId, status: "active" }, include: { profile: { include: { memberships: { where: { status: "active" } } } } } });
  for (const m of ms) {
    if (m.profile.type === "couple" && m.profile.memberships.length > 1) await leaveCouple(userId, m.profileId);
    else await db.communityProfile.update({ where: { id: m.profileId }, data: { status: "deleted" } });
  }
  await revokeAllSessions(userId, "deletion_requested");
  await audit("privacy.deletion_requested", { actorUserId: userId, targetType: "user", targetId: userId });
  return at;
}

/** Datenexport (Art. 15/20 DSGVO) – ausschließlich für die eingeloggte Person selbst. */
export async function exportOwnData(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, email: true, createdAt: true, identityStatus: true, identityVerifiedAt: true, timezone: true, locale: true,
      consents: true, subscriptions: true, orders: { select: { id: true, kind: true, amountCents: true, currency: true, status: true, createdAt: true } },
      memberships: { include: { profile: { include: { interests: { include: { interest: true } } } } } },
    },
  });
  const profileIds = user.memberships.map((m) => m.profileId);
  const messages = await db.message.findMany({ where: { senderUserId: userId }, select: { id: true, conversationId: true, body: true, createdAt: true } });
  const ledger = await db.tokenLedgerEntry.findMany({ where: { profileId: { in: profileIds } } });
  await audit("privacy.export_self", { actorUserId: userId, targetType: "user", targetId: userId });
  return { generatedAt: new Date().toISOString(), user, messagesSent: messages, tokenLedger: ledger };
}
