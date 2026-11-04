/**
 * Idempotenter Seed für Stammdaten. Erzeugt KEINE Mitglieder, KEINE Beiträge unter Fake-Profilen.
 * Demo-Daten nur mit SEED_DEMO=true und APP_ENV != production (klar gekennzeichnet).
 */
import { PrismaClient } from "@prisma/client";
import { INTERESTS, OFFICIAL_TOPICS, GAME_QUESTIONS, GIFTS } from "./seed-data";
import { EUROPE, REGIONS } from "../src/domain/countries";
import { DEFAULT_TOKEN_PACKAGES } from "../src/domain/messaging";
import { PLAN_FEATURES } from "../src/domain/plans";
import { PROVIDER_CATALOG } from "../src/server/payments/catalog";
import { syncRbac } from "../src/server/rbac";

const db = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/&/g, "und").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function seed() {
  await syncRbac();

  const from = new Date("2026-01-01T00:00:00Z");
  for (const [plan, price, intro] of [["basis", 0, null], ["premium", 1400, 700], ["gold", 2500, null]] as const) {
    await db.planVersion.upsert({
      where: { plan_version: { plan, version: 1 } },
      update: {},
      create: {
        plan, version: 1, priceCents: price, introPriceCents: intro, introMonths: intro ? 24 : null, validFrom: from,
        features: PLAN_FEATURES[plan],
      },
    });
  }
  for (const p of DEFAULT_TOKEN_PACKAGES) {
    await db.tokenPackageVersion.upsert({ where: { key_version: { key: p.key, version: 1 } }, update: {}, create: { ...p, version: 1 } });
  }
  for (const [i, g] of GIFTS.entries()) await db.giftType.upsert({ where: { key: g.key }, update: {}, create: { ...g, sort: i } });
  for (const it of INTERESTS) await db.interest.upsert({ where: { slug: it.slug }, update: { label: it.label, category: it.category }, create: it });

  await db.discountRule.upsert({ where: { key: "gold_party_10" }, update: {}, create: { key: "gold_party_10", amountCents: 1000, plan: "gold" } });

  for (const p of PROVIDER_CATALOG) {
    await db.providerConfiguration.upsert({
      where: { key: p.key },
      update: { displayName: p.displayName, implStatus: p.implStatus, eligibility: p.eligibility, capabilities: p.capabilities, notes: p.notes },
      create: {
        key: p.key, displayName: p.displayName, implStatus: p.implStatus, eligibility: p.eligibility, capabilities: p.capabilities,
        methods: p.methods, notes: p.notes, enabled: p.key === "test" && process.env.APP_ENV !== "production", priority: p.key === "test" ? 999 : 100,
      },
    });
  }

  // Länder & Regionen
  for (const c of EUROPE) await db.country.upsert({ where: { code: c.code }, update: { nameDe: c.nameDe, kind: c.kind }, create: c });
  for (const [code, regions] of Object.entries(REGIONS)) {
    for (const r of regions) {
      await db.region.upsert({ where: { countryCode_name: { countryCode: code, name: r.name } }, update: { cities: r.cities }, create: { countryCode: code, name: r.name, cities: r.cities } });
    }
  }

  // Kennenlernspiele
  await db.gameRuleVersion.upsert({ where: { version: 1 }, update: {}, create: { version: 1, roundSize: 10, minAnswered: 8, thresholdBp: 8000, active: true } });
  for (const q of GAME_QUESTIONS) {
    const exists = await db.gameQuestionVersion.findUnique({ where: { questionKey_version: { questionKey: q.key, version: 1 } } });
    if (exists) continue;
    await db.gameQuestionVersion.create({
      data: {
        questionKey: q.key, version: 1, variant: q.variant, category: q.category, text: q.text,
        options: {
          create: [
            ...q.options.map((label, i) => ({ key: `o${i + 1}`, label, sort: i })),
            { key: "not_my_topic", label: "Nicht mein Thema", sort: 99, neutral: true },
          ],
        },
      },
    });
  }

  // Offizielle Themenbereiche + Startfrage (als offizieller eropub-Beitrag, kein Fake-Mitglied)
  for (const t of OFFICIAL_TOPICS) {
    const slug = slugify(t.name);
    const group = await db.group.upsert({
      where: { slug },
      update: {},
      create: {
        slug, name: t.name, description: `Offizieller eropub-Themenbereich: ${t.name}. Respektvoller, nicht expliziter Austausch innerhalb der verifizierten Community.`,
        category: t.category, visibility: "open", official: true, status: "approved",
        rules: "Respektvoll, einvernehmlich, nicht explizit. Keine personenbezogenen Daten Dritter.",
      },
    });
    const cat = await db.forumCategory.upsert({ where: { slug: `${slug}-forum` }, update: {}, create: { slug: `${slug}-forum`, name: t.name, groupId: group.id } });
    const has = await db.thread.count({ where: { categoryId: cat.id, official: true } });
    if (!has) {
      await db.thread.create({
        data: { categoryId: cat.id, title: t.question, official: true, pinned: true, posts: { create: { body: `Startfrage von eropub: ${t.question}\n\nWir freuen uns auf euren Austausch.`, official: true } } },
      });
    }
  }

  for (const [slug, title, body] of [
    ["hilfe", "Hilfe & FAQ", "Hier findest du Antworten zu Registrierung, Verifizierung, Tarifen und Sicherheit."],
    ["community-regeln", "Communityregeln", "Respektvolle Kommunikation, Einvernehmlichkeit, keine Minderjährigen, keine Belästigung, kein Identitätsmissbrauch, keine nicht einvernehmlichen Medien, keine illegalen Angebote."],
    ["impressum", "Impressum", "ENTWURF – Angaben zum Diensteanbieter werden vor Livebetrieb ergänzt und rechtlich geprüft."],
    ["datenschutz", "Datenschutzerklärung", "ENTWURF – wird vor Livebetrieb rechtlich geprüft. Siehe docs/privacy.md."],
    ["agb", "Nutzungsbedingungen", "ENTWURF – wird vor Livebetrieb rechtlich geprüft."],
  ] as const) {
    await db.publicPage.upsert({ where: { slug }, update: {}, create: { slug, title, body } });
  }
  console.log("Seed abgeschlossen.");
}

if (process.argv[1]?.includes("seed")) {
  seed().then(() => db.$disconnect()).catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
}
