import { db, isUniqueViolation } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { can } from "@/domain/access";
import { personState, profileState } from "./state";
import { computeTicketTotal, redemptionKey } from "@/domain/discount";
import { audit } from "./audit";
import { hasPermission } from "./rbac";
import { requireCommunity } from "./community";

export const RESERVATION_MINUTES = 30;

/** Ticketkauf mit atomarer Gold-Rabatt-Reservierung (eindeutig je Regel+Event+Profil). */
export async function reserveTicket(userId: string, profileId: string, ticketTypeId: string, quantity = 1) {
  await requireCommunity(userId, profileId);
  const actor = (await personState(userId))!;
  const prof = (await profileState(profileId))!;
  if (quantity < 1 || quantity > 4) throw new AppError("qty", "Ungültige Anzahl.");
  const isGold = can("gold_discount", actor, prof).allowed;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "TicketType" WHERE id = ${ticketTypeId} FOR UPDATE`;
        if (!lockRows.length) throw notFound();
        const tt = await tx.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId }, include: { event: { include: { club: true } } } });
        const ev = tt.event;
        if (ev.status !== "approved" || ev.startsAt < new Date()) throw new AppError("closed", "Für dieses Event sind keine Buchungen möglich.");
        // abgelaufene Reservierungen freigeben
        await releaseExpired(tx, ev.id);
        const active = await tx.ticketOrder.aggregate({
          where: { ticketTypeId, status: { in: ["reserved", "paid", "awaiting_provider"] } }, _sum: { quantity: true },
        });
        const used = active._sum.quantity ?? 0;
        const capacityLeft = Math.min(tt.quota - used, ev.club ? ev.club.capacity - used : Infinity);
        const waitlist = capacityLeft < quantity;

        const rule = await tx.discountRule.findUnique({ where: { key: "gold_party_10" } });
        const already = rule
          ? await tx.discountRedemption.findUnique({ where: { activeKey: redemptionKey(rule.key, ev.id, profileId) } })
          : null;
        const calc = computeTicketTotal({
          ticketPriceCents: tt.priceCents, feeCents: tt.feeCents, quantity, discountable: tt.discountable,
          eventEligible: ev.goldDiscountEligible, isGold: isGold && !!rule?.active, alreadyRedeemed: !!already,
          otherCouponApplied: false, combinable: rule?.combinable ?? false, amountCents: rule?.amountCents,
        });
        const order = await tx.ticketOrder.create({
          data: {
            eventId: ev.id, ticketTypeId, profileId, userId, quantity, grossCents: calc.grossCents,
            discountCents: waitlist ? 0 : calc.discountCents, payableCents: waitlist ? calc.grossCents : calc.payableCents,
            status: waitlist ? "waitlist" : ev.providerPaymentUrl ? "awaiting_provider" : "reserved",
            reservedUntil: waitlist ? null : new Date(Date.now() + RESERVATION_MINUTES * 60_000),
          },
        });
        if (!waitlist && calc.discountCents > 0 && rule) {
          await tx.discountRedemption.create({
            data: {
              ruleId: rule.id, eventId: ev.id, profileId, ticketOrderId: order.id, amountCents: calc.discountCents,
              activeKey: redemptionKey(rule.key, ev.id, profileId),
            },
          });
        }
        return { order, discount: calc, waitlist, providerPaymentUrl: ev.providerPaymentUrl };
      }, { timeout: 15000 });
    } catch (e) {
      // paralleler Checkout hat die Rabattreservierung bereits angelegt → erneut ohne Rabatt berechnen
      if (isUniqueViolation(e) && attempt < 2) continue;
      throw e;
    }
  }
  throw new AppError("retry", "Bitte erneut versuchen.");
}

export async function releaseExpired(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], eventId?: string) {
  const expired = await tx.ticketOrder.findMany({
    where: { status: { in: ["reserved", "awaiting_provider"] }, reservedUntil: { lt: new Date() }, ...(eventId ? { eventId } : {}) },
  });
  for (const o of expired) {
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "expired" } });
    await tx.discountRedemption.updateMany({ where: { ticketOrderId: o.id, status: "reserved" }, data: { status: "released", activeKey: null } });
  }
  return expired.length;
}

export async function cancelTicketOrder(userId: string, ticketOrderId: string) {
  const o = await db.ticketOrder.findUnique({ where: { id: ticketOrderId } });
  if (!o || o.userId !== userId) throw forbidden();
  if (!["reserved", "waitlist", "awaiting_provider"].includes(o.status)) {
    throw new AppError("paid", "Bezahlte Tickets werden gemäß Stornoregeln über den Support erstattet.");
  }
  await db.$transaction(async (tx) => {
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "canceled" } });
    await tx.discountRedemption.updateMany({ where: { ticketOrderId: o.id }, data: { status: "released", activeKey: null } });
  });
}

/** Clubparty mit Direktzahlung an Anbieter: manueller administrativer Zahlungsabgleich. */
export async function confirmProviderPayment(adminUserId: string, ticketOrderId: string, note: string) {
  if (!(await hasPermission(adminUserId, "events.manage"))) throw forbidden();
  if (!note.trim()) throw new AppError("note", "Bitte Abgleichsnachweis notieren.");
  await db.$transaction(async (tx) => {
    const o = await tx.ticketOrder.findUniqueOrThrow({ where: { id: ticketOrderId } });
    if (o.status !== "awaiting_provider" && o.status !== "reserved") throw new AppError("state", `Status ${o.status} kann nicht bestätigt werden.`);
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "paid", paidAt: new Date() } });
    await tx.discountRedemption.updateMany({ where: { ticketOrderId: o.id, status: "reserved" }, data: { status: "redeemed" } });
    await audit("ticket.provider_payment_confirmed", { actorUserId: adminUserId, targetType: "ticket_order", targetId: o.id, meta: { note } }, tx);
  });
}

export async function listVisibleEvents() {
  return db.event.findMany({
    where: { status: "approved", endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { ticketTypes: true, club: { select: { name: true, city: true, stars: true } }, organizer: { select: { legalName: true, isPartner: true } } },
  });
}

/** Organizer reicht ein; Freigabe ausschließlich durch eropub (Kapazitätsprüfung gegen Club). */
export async function submitEvent(userId: string, profileId: string, input: {
  title: string; description: string; regionCountry: string; city?: string; startsAt: Date; endsAt: Date; capacity: number; clubId?: string;
  ticketTypes: { name: string; priceCents: number; quota: number; personsPerTicket?: number }[]; providerPaymentUrl?: string;
}) {
  const org = await db.organizer.findUnique({ where: { profileId } });
  const member = await db.profileMembership.findFirst({ where: { userId, profileId, status: "active" } });
  if (!org || !member || org.status !== "approved") throw forbidden("Nur geprüfte Veranstalter können Events einreichen.");
  if (input.endsAt <= input.startsAt) throw new AppError("dates", "Ende muss nach Beginn liegen.");
  if (input.clubId) {
    const club = await db.club.findUnique({ where: { id: input.clubId } });
    if (!club || club.organizerId !== org.id || club.status !== "approved") throw forbidden("Club nicht freigegeben.");
    if (input.capacity > club.capacity) throw new AppError("capacity", `Kapazität überschreitet die Clubkapazität (${club.capacity}).`);
  }
  if (input.providerPaymentUrl && !/^https:\/\//.test(input.providerPaymentUrl)) throw new AppError("url", "Zahlungslink muss https verwenden.");
  return db.event.create({
    data: {
      organizerId: org.id, clubId: input.clubId, title: input.title, description: input.description, regionCountry: input.regionCountry,
      city: input.city, startsAt: input.startsAt, endsAt: input.endsAt, capacity: input.capacity, providerPaymentUrl: input.providerPaymentUrl,
      status: "pending_approval", ticketTypes: { create: input.ticketTypes.map((t) => ({ ...t, personsPerTicket: t.personsPerTicket ?? 1 })) },
    },
  });
}

export async function decideEvent(adminUserId: string, eventId: string, status: "approved" | "rejected" | "canceled", goldEligible?: boolean) {
  if (!(await hasPermission(adminUserId, "events.manage"))) throw forbidden();
  const ev = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { club: true, organizer: true } });
  if (status === "approved" && ev.club && ev.capacity > ev.club.capacity) throw new AppError("capacity", "Kapazität übersteigt Club.");
  if (goldEligible && !ev.isEropubEvent && !ev.organizer.isPartner) {
    throw new AppError("partner", "Gold-Rabatt nur für eropub-Events oder vertraglich bestätigte Partner.");
  }
  await db.event.update({ where: { id: eventId }, data: { status, goldDiscountEligible: goldEligible ?? ev.goldDiscountEligible } });
  await audit(`event.${status}`, { actorUserId: adminUserId, targetType: "event", targetId: eventId });
}

export async function rateClub(adminUserId: string, clubId: string, stars: number) {
  if (!(await hasPermission(adminUserId, "events.manage"))) throw forbidden();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError("stars", "1 bis 5 Sterne.");
  await db.club.update({ where: { id: clubId }, data: { stars, starsById: adminUserId } });
  await audit("club.rated", { actorUserId: adminUserId, targetType: "club", targetId: clubId, meta: { stars } });
}
