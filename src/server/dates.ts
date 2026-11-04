import { db } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { requireCommunity } from "./community";
import { getSetting } from "./settings";
import { isAllowedCountry } from "@/domain/countries";
import { blockedIds } from "./discover";

/**
 * Dates (persönlich oder als Gruppe). Nur vollständig verifizierte Profile (Capability „community“).
 *
 * Umkreissuche – bewusste Einschränkung: Es gibt keine Geokodierung von Postleitzahlen.
 * Der Radius wird daher über gleiche Länder + gemeinsame PLZ-Präfixe angenähert
 * (≤ 25 km: 3 Stellen, ≤ 100 km: 2 Stellen, ≤ 250 km: 1 Stelle, darüber: ganzes Land).
 * Das ist nur eine grobe Näherung und an Präfixgrenzen ungenau.
 */

export const RADIUS_OPTIONS = [10, 25, 50, 100, 250, 1000] as const;

export function prefixLengthForRadius(km: number): number {
  if (km <= 25) return 3;
  if (km <= 100) return 2;
  if (km <= 250) return 1;
  return 0;
}

const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;

export interface DateInput {
  kind: "personal" | "group";
  title: string;
  description: string;
  postalCode: string;
  country: string;
  when?: Date | null;
  preferences?: string[];
  maxPeople?: number | null;
}

async function requireDates(userId: string, profileId: string) {
  await requireCommunity(userId, profileId);
  const features = await getSetting("features");
  if (!features.datesEnabled) throw new AppError("disabled", "Dates sind derzeit deaktiviert.", 503);
}

export async function createDate(userId: string, profileId: string, input: DateInput) {
  await requireDates(userId, profileId);
  const title = input.title.trim();
  const description = input.description.trim();
  const postal = input.postalCode.replace(/\s+/g, "").toUpperCase();
  if (title.length < 4 || title.length > 120) throw new AppError("title", "Titel: 4 bis 120 Zeichen.");
  if (description.length < 10) throw new AppError("description", "Beschreibung: mindestens 10 Zeichen.");
  if ([...description].length > 2000) throw new AppError("description", "Beschreibung: höchstens 2000 Zeichen.");
  if (!POSTAL_RE.test(postal)) throw new AppError("postal", "Bitte gib eine gültige Postleitzahl an.");
  if (!isAllowedCountry(input.country)) throw new AppError("country", "Land nicht unterstützt.");
  if (input.kind !== "personal" && input.kind !== "group") throw new AppError("kind", "Ungültige Art.");
  if (input.when && input.when.getTime() < Date.now() - 3600_000) throw new AppError("when", "Der Termin liegt in der Vergangenheit.");
  let maxPeople: number | null = null;
  if (input.kind === "group") {
    maxPeople = input.maxPeople ?? null;
    if (maxPeople != null && (!Number.isInteger(maxPeople) || maxPeople < 3 || maxPeople > 50)) throw new AppError("max", "Gruppengröße: 3 bis 50 Personen.");
  }
  const preferences = (input.preferences ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 10).map((p) => p.slice(0, 40));
  const open = await db.dateOffer.count({ where: { profileId, status: "open" } });
  if (open >= 10) throw new AppError("limit", "Du hast bereits 10 offene Dates. Schließe zuerst ein älteres.");
  return db.dateOffer.create({
    data: {
      profileId, kind: input.kind, title, description, postalCode: postal, country: input.country.toUpperCase(),
      when: input.when ?? null, preferences, maxPeople,
    },
  });
}

export async function searchDates(userId: string, profileId: string, q: { country: string; postalCode?: string; radiusKm?: number }) {
  await requireDates(userId, profileId);
  const blocked = await blockedIds(profileId);
  const postal = (q.postalCode ?? "").replace(/\s+/g, "").toUpperCase();
  const len = postal ? prefixLengthForRadius(q.radiusKm ?? 50) : 0;
  const prefix = postal.slice(0, len);
  return db.dateOffer.findMany({
    where: {
      status: "open", country: q.country.toUpperCase(),
      ...(prefix ? { postalCode: { startsWith: prefix } } : {}),
      profileId: { notIn: [...blocked] },
      profile: { status: "active" },
      OR: [{ when: null }, { when: { gte: new Date(Date.now() - 6 * 3600_000) } }],
    },
    include: { profile: { select: { handle: true, type: true, verifiedBadge: true } } },
    orderBy: [{ when: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function listOwnDates(userId: string, profileId: string) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!m) throw forbidden();
  return db.dateOffer.findMany({ where: { profileId, status: { not: "removed" } }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function closeDate(userId: string, profileId: string, dateId: string) {
  const m = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!m) throw forbidden();
  const d = await db.dateOffer.findUnique({ where: { id: dateId } });
  if (!d || d.profileId !== profileId) throw notFound();
  await db.dateOffer.update({ where: { id: d.id }, data: { status: "closed" } });
}

/** Anzeige: nur grobe PLZ (erste Stellen), keine genaue Lage. */
export function coarsePostalDisplay(postal: string): string {
  return `${postal.slice(0, 3)}…`;
}
