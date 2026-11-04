import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { discoverProfiles, getProfileForViewer, nextImageCandidate } from "@/server/discover";
import { blockProfile } from "@/server/safety";
import { makeProfile, makeUser, prepareDb } from "./helpers";

beforeAll(prepareDb);

describe("Entdecken", () => {
  it("schließt eigenes, blockierte (beide Richtungen), gelöschte und gesperrte Profile aus", async () => {
    const u = await makeUser();
    const me = await makeProfile("single", [u]);
    const visible = await makeProfile("single", [await makeUser()]);
    const blockedByMe = await makeProfile("single", [await makeUser()]);
    const ub = await makeUser();
    const blocksMe = await makeProfile("single", [ub]);
    const deleted = await makeProfile("single", [await makeUser()]);
    const suspendedUser = await makeUser();
    const suspended = await makeProfile("single", [suspendedUser]);
    await blockProfile(u.id, me.id, blockedByMe.id);
    await blockProfile(ub.id, blocksMe.id, me.id);
    await db.communityProfile.update({ where: { id: deleted.id }, data: { status: "deleted" } });
    await db.user.update({ where: { id: suspendedUser.id }, data: { status: "suspended" } });

    const ids = (await discoverProfiles(u.id, me.id, {}, 1000)).map((x) => x.id);
    expect(ids).toContain(visible.id);
    for (const x of [me.id, blockedByMe.id, blocksMe.id, deleted.id, suspended.id]) expect(ids).not.toContain(x);

    await expect(getProfileForViewer(u.id, me.id, blocksMe.handle)).rejects.toMatchObject({ status: 404 });
    await expect(getProfileForViewer(u.id, me.id, deleted.handle)).rejects.toMatchObject({ status: 404 });
    const img = await nextImageCandidate(u.id, me.id);
    expect(img?.id).not.toBe(blocksMe.id);
  });

  it("erklärt die Reihenfolge mit konkreten Gemeinsamkeiten, ohne Prozentwerte; Filter greifen", async () => {
    const u = await makeUser();
    const me = await makeProfile("single", [u]);
    const ints = await db.interest.findMany({ take: 3, orderBy: { slug: "asc" } });
    await db.communityProfile.update({ where: { id: me.id }, data: { lookingFor: ["dating", "events"], lat: 52.5, lng: 13.4, verifiedBadge: true } });
    await db.profileInterest.createMany({ data: ints.map((i) => ({ profileId: me.id, interestId: i.id })) });

    const match = await makeProfile("couple", [await makeUser(), await makeUser()]);
    await db.communityProfile.update({
      where: { id: match.id },
      data: { lookingFor: ["events"], lat: 52.5, lng: 13.5, lastActiveAt: new Date(), verifiedBadge: true, birthYearB: 1985 },
    });
    await db.profileInterest.createMany({ data: ints.slice(0, 2).map((i) => ({ profileId: match.id, interestId: i.id })) });

    const list = await discoverProfiles(u.id, me.id, { type: "couple", interests: [ints[0].slug] }, 1000);
    const item = list.find((x) => x.id === match.id)!;
    expect(item).toBeTruthy();
    expect(list.every((x) => x.type === "couple")).toBe(true);
    expect(item.reasons).toContain(`2 gemeinsame Interessen: ${ints[0].label}, ${ints[1].label}`);
    expect(item.reasons).toContain("sucht ebenfalls: Events & Partys");
    expect(item.reasons).toContain("aktiv in den letzten 7 Tagen");
    expect(item.reasons).toContain("verifiziert");
    expect(item.distance).toBe("unter 10 km");
    expect(item.reasons.join(" ")).not.toMatch(/%|Prozent/);
    expect(list[0].rank).toBeGreaterThanOrEqual(list[list.length - 1].rank);

    // Altersfilter: beide Personen eines Paars müssen passen
    const year = new Date().getUTCFullYear();
    const tooYoungRange = await discoverProfiles(u.id, me.id, { type: "couple", maxAge: year - 1988 }, 1000);
    expect(tooYoungRange.some((x) => x.id === match.id)).toBe(false);
    const dist = await discoverProfiles(u.id, me.id, { maxDistanceKm: 25 }, 1000);
    expect(dist.every((x) => x.distance === "unter 10 km" || x.distance === "unter 25 km")).toBe(true);
  });

  it("verweigert Entdecken im Namen eines fremden Profils", async () => {
    const u = await makeUser();
    const other = await makeProfile("single", [await makeUser()]);
    await expect(discoverProfiles(u.id, other.id)).rejects.toMatchObject({ status: 403 });
  });
});
