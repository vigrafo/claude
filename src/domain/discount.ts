/** Gold-Partyrabatt: 10 € auf höchstens ein berechtigtes, bezahltes Ticket je Event und Gold-Profil. */

export interface DiscountInput {
  ticketPriceCents: number; // rabattfähiger Ticketpreis (ohne Gebühren)
  feeCents: number;
  quantity: number;
  discountable: boolean;
  eventEligible: boolean;
  isGold: boolean;
  alreadyRedeemed: boolean;
  otherCouponApplied: boolean;
  combinable: boolean;
  amountCents?: number;
}

export interface DiscountResult {
  discountCents: number;
  grossCents: number;
  payableCents: number;
  reason?: string;
}

export function computeTicketTotal(i: DiscountInput): DiscountResult {
  const gross = i.ticketPriceCents * i.quantity + i.feeCents * i.quantity;
  const deny = (reason: string): DiscountResult => ({ discountCents: 0, grossCents: gross, payableCents: gross, reason });
  if (!i.isGold) return deny("Kein aktiver Gold-Status.");
  if (!i.eventEligible) return deny("Event ist nicht für den Gold-Rabatt freigegeben.");
  if (!i.discountable) return deny("Ticketart ist nicht rabattfähig.");
  if (i.alreadyRedeemed) return deny("Rabatt für dieses Event bereits genutzt.");
  if (i.otherCouponApplied && !i.combinable) return deny("Nicht mit anderen Gutscheinen kombinierbar.");
  // Nur auf ein Ticket, höchstens bis zum rabattfähigen Preis, Gebühren nicht rabattfähig.
  const amount = i.amountCents ?? 1000;
  const discount = Math.max(0, Math.min(amount, i.ticketPriceCents));
  return { discountCents: discount, grossCents: gross, payableCents: gross - discount };
}

export function redemptionKey(ruleKey: string, eventId: string, profileId: string): string {
  return `${ruleKey}:${eventId}:${profileId}`;
}
