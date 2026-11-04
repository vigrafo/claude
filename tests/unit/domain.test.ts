import { describe, expect, it } from "vitest";
import {
  addMonthsUtc, firstRegularChargeDate, introPriceEndsAt, planChangeKind, premiumPriceForPeriod, priceForPeriod, priceNoticeDue,
} from "@/domain/plans";
import { can, profileVerified, passesContactFilter, type PersonState, type ProfileState } from "@/domain/access";
import { answersHash, requiredHits, scoreRound, resultText } from "@/domain/games";
import { computeTicketTotal } from "@/domain/discount";
import { validateMessageBody } from "@/domain/messaging";
import { EUROPE, isAllowedCountry } from "@/domain/countries";
import { distanceBucket, coarsePostal } from "@/domain/geo";

const d = (s: string) => new Date(s);

describe("Premium-Preisregel (24 Monate je Mitglied)", () => {
  it("berechnet Fristende als 24 Kalendermonate", () => {
    expect(introPriceEndsAt(d("2026-01-15T10:00:00Z")).toISOString()).toBe("2028-01-15T10:00:00.000Z");
  });
  it("klemmt Monatsende korrekt (31.01. + 1 Monat)", () => {
    expect(addMonthsUtc(d("2027-01-31T00:00:00Z"), 1).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(addMonthsUtc(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });
  it("Monat 24 kostet 7 €, Monat 25 kostet 14 €", () => {
    const start = d("2026-03-01T00:00:00Z");
    const end = introPriceEndsAt(start);
    const month24 = addMonthsUtc(start, 23); // 24. Abrechnungszeitraum
    const month25 = addMonthsUtc(start, 24);
    expect(premiumPriceForPeriod({ periodStart: month24, introEndsAt: end })).toBe(700);
    expect(premiumPriceForPeriod({ periodStart: month25, introEndsAt: end })).toBe(1400);
  });
  it("Kündigung + Neustart setzt die Frist nicht zurück", () => {
    const first = d("2026-01-10T00:00:00Z");
    const end = introPriceEndsAt(first);
    // Neustart nach Pause im Jahr 2028 → bereits Regulärpreis
    expect(premiumPriceForPeriod({ periodStart: d("2028-02-01T00:00:00Z"), introEndsAt: end })).toBe(1400);
    // Neustart innerhalb der Frist → weiterhin Einführungspreis, keine Verlängerung um die Pause
    expect(premiumPriceForPeriod({ periodStart: d("2027-06-01T00:00:00Z"), introEndsAt: end })).toBe(700);
  });
  it("Erstbuchung ohne Frist ergibt Einführungspreis; Gold kostet stets 25 €", () => {
    expect(priceForPeriod("premium", d("2026-11-01T00:00:00Z"), null)).toBe(700);
    expect(priceForPeriod("gold", d("2026-11-01T00:00:00Z"), null)).toBe(2500);
    expect(priceForPeriod("basis", d("2026-11-01T00:00:00Z"), null)).toBe(0);
  });
  it("keine taggenaue Nachforderung: laufender Zeitraum bleibt beim alten Preis", () => {
    const first = d("2026-01-20T00:00:00Z");
    const end = introPriceEndsAt(first); // 2028-01-20
    // Abo-Anker am 5. des Monats: Periode ab 2028-01-05 läuft über das Fristende → 7 €
    expect(premiumPriceForPeriod({ periodStart: d("2028-01-05T00:00:00Z"), introEndsAt: end })).toBe(700);
    expect(firstRegularChargeDate(d("2026-02-05T00:00:00Z"), end).toISOString()).toBe("2028-02-05T00:00:00.000Z");
  });
  it("Zeitzonen: Frist wird in UTC gespeichert, Mitternacht MEZ bleibt konsistent", () => {
    const first = d("2026-12-31T23:30:00Z"); // 01.01.2027 00:30 MEZ
    const end = introPriceEndsAt(first);
    expect(end.toISOString()).toBe("2028-12-31T23:30:00.000Z");
    expect(premiumPriceForPeriod({ periodStart: d("2028-12-31T23:29:59Z"), introEndsAt: end })).toBe(700);
    expect(premiumPriceForPeriod({ periodStart: d("2028-12-31T23:30:00Z"), introEndsAt: end })).toBe(1400);
  });
  it("Preis-Hinweis 30 Tage vorher", () => {
    expect(priceNoticeDue(d("2028-01-10T00:00:00Z"), d("2028-02-05T00:00:00Z"))).toBe(true);
    expect(priceNoticeDue(d("2027-12-01T00:00:00Z"), d("2028-02-05T00:00:00Z"))).toBe(false);
  });
  it("Wechselarten", () => {
    expect(planChangeKind("premium", "gold")).toBe("upgrade_now");
    expect(planChangeKind("gold", "premium")).toBe("downgrade_at_period_end");
  });
});

function person(p: Partial<PersonState> & { userId: string }): PersonState {
  return { status: "active", emailVerified: true, adultConfirmed: true, identityStatus: "verified", plan: "basis", ...p };
}
function profile(type: ProfileState["type"], members: PersonState[]): ProfileState {
  return { profileId: "p", type, status: "active", members };
}

describe("Zugriffsregeln", () => {
  it("Paar mit nur einer geprüften Person bleibt gesperrt", () => {
    const a = person({ userId: "a", plan: "premium" });
    const b = person({ userId: "b", identityStatus: "pending_review" });
    const pr = profile("couple", [a, b]);
    expect(profileVerified(pr)).toBe(false);
    expect(can("community", a, pr).allowed).toBe(false);
    expect(can("calls", a, pr).allowed).toBe(false);
    // Token-Chat bleibt möglich – aber mit Tokenkosten, da Premium ohne Verifizierung nicht greift
    expect(can("send_message", a, pr)).toEqual({ allowed: true, tokenCostPerMessage: 1 });
  });
  it("Paarprofil mit nur einer Person ist nicht verifiziert", () => {
    expect(profileVerified(profile("couple", [person({ userId: "a" })]))).toBe(false);
  });
  it("nicht verifizierte Person: Profile sehen, mit Tokens schreiben, keine Community", () => {
    const a = person({ userId: "a", identityStatus: "not_started" });
    const pr = profile("single", [a]);
    expect(can("view_profiles", a, pr).allowed).toBe(true);
    expect(can("send_message", a, pr).tokenCostPerMessage).toBe(1);
    expect(can("community", a, pr).allowed).toBe(false);
    expect(can("games", a, pr).allowed).toBe(false);
  });
  it("Konto ohne Volljährigkeitsbestätigung oder E-Mail erreicht nichts", () => {
    const a = person({ userId: "a", adultConfirmed: false });
    expect(can("view_profiles", a, profile("single", [a])).allowed).toBe(false);
    const b = person({ userId: "b", emailVerified: false });
    expect(can("read_messages", b, profile("single", [b])).allowed).toBe(false);
  });
  it("verifiziertes Premium/Gold schreibt ohne Tokens, Gold hat Gold-Inhalte", () => {
    const a = person({ userId: "a", plan: "premium" });
    expect(can("send_message", a, profile("single", [a])).tokenCostPerMessage).toBe(0);
    expect(can("gold_content", a, profile("single", [a])).allowed).toBe(false);
    const g = person({ userId: "g", plan: "gold" });
    expect(can("gold_content", g, profile("single", [g])).allowed).toBe(true);
    expect(can("calls", g, profile("single", [g])).allowed).toBe(true);
  });
  it("abgelaufene Verifizierung entzieht Rechte", () => {
    const a = person({ userId: "a", plan: "gold", identityExpiresAt: d("2020-01-01T00:00:00Z") });
    expect(can("calls", a, profile("single", [a])).allowed).toBe(false);
  });
  it("Kontaktfilter", () => {
    expect(passesContactFilter({ allowTypes: ["couple"] }, { type: "single", verified: true, ages: [30] })).toBe(false);
    expect(passesContactFilter({ verifiedOnly: true }, { type: "single", verified: false, ages: [30] })).toBe(false);
    expect(passesContactFilter({ minAge: 30 }, { type: "couple", verified: true, ages: [31, 29] })).toBe(false);
    expect(passesContactFilter(undefined, { type: "single", verified: false, ages: [30] })).toBe(true);
  });
});

function answers(n: number, prefix: string, valueFn: (i: number) => string | null) {
  const m: Record<string, string | null> = {};
  for (let i = 0; i < n; i++) m[`${prefix}${i}`] = valueFn(i);
  return m;
}

describe("Fragen-Match-Auswertung", () => {
  it("10 Antworten mit 8 Treffern ergeben Match", () => {
    const a = answers(10, "q", () => "x");
    const b = answers(10, "q", (i) => (i < 8 ? "x" : "y"));
    const r = scoreRound(a, b);
    expect(r.status).toBe("match");
    expect(resultText(r)).toBe("8 von 10 Antworten passen zusammen – ihr habt einen Fragen-Match!");
  });
  it("10 Antworten mit 7 Treffern ergeben keinen Match", () => {
    const r = scoreRound(answers(10, "q", () => "x"), answers(10, "q", (i) => (i < 7 ? "x" : "y")));
    expect(r.status).toBe("no_match");
  });
  it("8 Antworten benötigen 7 Treffer", () => {
    expect(requiredHits(8, 8000)).toBe(7);
    const a = answers(10, "q", (i) => (i < 8 ? "x" : null));
    expect(scoreRound(a, answers(10, "q", (i) => (i < 7 ? "x" : "y"))).status).toBe("match");
    expect(scoreRound(a, answers(10, "q", (i) => (i < 6 ? "x" : "y"))).status).toBe("no_match");
  });
  it("unter 8 gemeinsam beantworteten Fragen: Runde unvollständig", () => {
    const a = answers(10, "q", (i) => (i < 7 ? "x" : null));
    expect(scoreRound(a, answers(10, "q", () => "x")).status).toBe("incomplete");
  });
  it("Überspringen und 'Nicht mein Thema' zählen nicht als Treffer", () => {
    const a = answers(10, "q", (i) => (i < 8 ? "x" : "not_my_topic"));
    const b = answers(10, "q", (i) => (i < 7 ? "x" : "not_my_topic"));
    const r = scoreRound(a, b);
    expect(r.answeredBoth).toBe(10);
    expect(r.hits).toBe(7);
    expect(r.status).toBe("no_match");
  });
  it("Antwort-Hash ist reihenfolgeunabhängig und änderungssensitiv", () => {
    expect(answersHash({ a: "1", b: null })).toBe(answersHash({ b: null, a: "1" }));
    expect(answersHash({ a: "1" })).not.toBe(answersHash({ a: "2" }));
  });
});

describe("Gold-Rabatt", () => {
  const base = {
    ticketPriceCents: 3000, feeCents: 200, quantity: 1, discountable: true, eventEligible: true,
    isGold: true, alreadyRedeemed: false, otherCouponApplied: false, combinable: false,
  };
  it("10 € Rabatt, Gebühren nicht rabattfähig", () => {
    expect(computeTicketTotal(base)).toEqual({ discountCents: 1000, grossCents: 3200, payableCents: 2200 });
  });
  it("Rabatt höchstens bis zum Ticketpreis", () => {
    expect(computeTicketTotal({ ...base, ticketPriceCents: 600 }).discountCents).toBe(600);
  });
  it("nur einmal je Event, nur mit Gold, nicht kombinierbar", () => {
    expect(computeTicketTotal({ ...base, alreadyRedeemed: true }).discountCents).toBe(0);
    expect(computeTicketTotal({ ...base, isGold: false }).discountCents).toBe(0);
    expect(computeTicketTotal({ ...base, otherCouponApplied: true }).discountCents).toBe(0);
  });
  it("bei 2 Tickets nur auf eines", () => {
    expect(computeTicketTotal({ ...base, quantity: 2 })).toEqual({ discountCents: 1000, grossCents: 6400, payableCents: 5400 });
  });
});

describe("Nachrichtenlängen ohne stille Kürzung", () => {
  it("Text max 2000, Geschenktext max 500", () => {
    expect(validateMessageBody("a".repeat(2000), "text")).toBeNull();
    expect(validateMessageBody("a".repeat(2001), "text")?.message).toContain("2000");
    expect(validateMessageBody("a".repeat(501), "gift")?.message).toContain("500");
    expect(validateMessageBody("   ", "text")).not.toBeNull();
  });
});

describe("Länder & Geo", () => {
  it("Russland und Belarus ausgeschlossen, Kleinstaaten enthalten", () => {
    expect(isAllowedCountry("RU")).toBe(false);
    expect(isAllowedCountry("BY")).toBe(false);
    expect(EUROPE.some((c) => c.code === "RU" || c.code === "BY")).toBe(false);
    for (const c of ["VA", "SM", "MC", "LI", "AD", "MT", "GI", "TR", "CY"]) expect(isAllowedCountry(c)).toBe(true);
  });
  it("grobe Entfernungen und PLZ", () => {
    expect(distanceBucket(3)).toBe("unter 10 km");
    expect(coarsePostal("10 115")).toBe("10");
  });
});
