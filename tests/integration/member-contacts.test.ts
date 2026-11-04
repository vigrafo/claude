import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { sendContactRequest, respondContactRequest, toggleFavorite, setLike, mutualLikes } from "@/server/contacts";
import { blockProfile } from "@/server/safety";
import { areConnected } from "@/server/state";
import { getSetting } from "@/server/settings";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

describe("Kontaktanfragen", () => {
  it("Tageslimit aus den Einstellungen greift", async () => {
    const u = await makeUser({ verified: false });
    const p = await makeProfile("single", [u]);
    const limit = (await getSetting("ratelimits")).contactRequestsPerDay;
    // bestehende Anfragen bis knapp unter das Limit simulieren
    const targets = [];
    for (let i = 0; i < limit; i++) targets.push(await makeProfile("single", [await makeUser()]));
    await db.contactRequest.createMany({ data: targets.slice(0, limit - 1).map((t) => ({ fromId: p.id, toId: t.id })) });
    await expect(sendContactRequest(u.id, p.id, targets[limit - 1].id)).resolves.toMatchObject({ status: "sent" });
    const extra = await makeProfile("single", [await makeUser()]);
    await expect(sendContactRequest(u.id, p.id, extra.id)).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("Blockierung hat Vorrang vor Limit und Annahme; fremdes Profil (IDOR) wird abgewiesen", async () => {
    const u1 = await makeUser();
    const p1 = await makeProfile("single", [u1]);
    const u2 = await makeUser();
    const p2 = await makeProfile("single", [u2]);
    await blockProfile(u2.id, p2.id, p1.id);
    await expect(sendContactRequest(u1.id, p1.id, p2.id)).rejects.toMatchObject({ status: 403, message: "Kontakt nicht möglich." });
    // Limit ausschöpfen – Fehler bleibt Blockierung (Vorrang)
    const limit = (await getSetting("ratelimits")).contactRequestsPerDay;
    const others = [];
    for (let i = 0; i < limit; i++) others.push(await makeProfile("single", [await makeUser()]));
    await db.contactRequest.createMany({ data: others.map((t) => ({ fromId: p1.id, toId: t.id })) });
    await expect(sendContactRequest(u1.id, p1.id, p2.id)).rejects.toMatchObject({ status: 403 });
    // fremde Person darf nicht im Namen von p1 handeln
    const stranger = await makeUser();
    const p3 = await makeProfile("single", [await makeUser()]);
    await expect(sendContactRequest(stranger.id, p1.id, p3.id)).rejects.toMatchObject({ status: 403 });
  });

  it("Kontaktfilter hat Vorrang; Annahme erzeugt Verbindung; Gegenanfrage verbindet sofort", async () => {
    const u1 = await makeUser({ verified: false });
    const p1 = await makeProfile("single", [u1]);
    const u2 = await makeUser();
    const p2 = await makeProfile("single", [u2]);
    await db.communityProfile.update({ where: { id: p2.id }, data: { contactFilter: { verifiedOnly: true } } });
    await expect(sendContactRequest(u1.id, p1.id, p2.id)).rejects.toMatchObject({ status: 403 });
    await db.communityProfile.update({ where: { id: p2.id }, data: { contactFilter: {} } });
    const r = await sendContactRequest(u1.id, p1.id, p2.id);
    expect(r.status).toBe("sent");
    await expect(sendContactRequest(u1.id, p1.id, p2.id)).rejects.toMatchObject({ code: "duplicate" });
    // nur Empfänger darf annehmen
    await expect(respondContactRequest(u1.id, p1.id, (r as { requestId: string }).requestId, true)).rejects.toMatchObject({ code: "not_pending" });
    await respondContactRequest(u2.id, p2.id, (r as { requestId: string }).requestId, true);
    expect(await areConnected(p1.id, p2.id)).toBe(true);

    const u3 = await makeUser();
    const p3 = await makeProfile("single", [u3]);
    await sendContactRequest(u3.id, p3.id, p1.id);
    await expect(sendContactRequest(u1.id, p1.id, p3.id)).resolves.toMatchObject({ status: "connected" });
    expect(await areConnected(p1.id, p3.id)).toBe(true);
  });

  it("Favoriten und Likes: Like gibt keinen Kontakt frei, gegenseitige Likes nur als Vorschlag", async () => {
    const u1 = await makeUser();
    const p1 = await makeProfile("single", [u1]);
    const u2 = await makeUser();
    const p2 = await makeProfile("couple", [u2, await makeUser()]);
    expect(await toggleFavorite(u1.id, p1.id, p2.id)).toBe(true);
    expect(await toggleFavorite(u1.id, p1.id, p2.id)).toBe(false);
    expect((await setLike(u1.id, p1.id, p2.id, "like")).mutual).toBe(false);
    expect((await setLike(u2.id, p2.id, p1.id, "like")).mutual).toBe(true);
    expect(await areConnected(p1.id, p2.id)).toBe(false);
    expect((await mutualLikes(u1.id, p1.id)).map((x) => x.id)).toContain(p2.id);
  });
});
