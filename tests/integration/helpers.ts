import { execSync } from "node:child_process";
import { db } from "@/server/db";
import { randomToken } from "@/server/crypto";
import type { PlanKey } from "@/domain/plans";

let prepared = false;

export async function prepareDb() {
  if (prepared) return;
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(",")} RESTART IDENTITY CASCADE`);
  const { seed } = await import("../../prisma/seed");
  await seed();
  prepared = true;
}

export async function makeUser(opts: { verified?: boolean; plan?: PlanKey; email?: string } = {}) {
  const u = await db.user.create({
    data: {
      email: opts.email ?? `${randomToken(6)}@test.local`, passwordHash: "x", emailVerifiedAt: new Date(), adultConfirmedAt: new Date(),
      identityStatus: opts.verified === false ? "not_started" : "verified", identityVerifiedAt: opts.verified === false ? null : new Date(),
    },
  });
  if (opts.plan && opts.plan !== "basis") {
    await db.entitlement.create({ data: { userId: u.id, key: `plan:${opts.plan}`, source: "test", validFrom: new Date(Date.now() - 1000) } });
  }
  return u;
}

export async function makeProfile(type: "single" | "couple", users: { id: string }[], tokens = 0) {
  const p = await db.communityProfile.create({
    data: {
      handle: `t_${randomToken(5).replace(/[^a-zA-Z0-9]/g, "x")}`, type, status: "active", birthYearA: 1990,
      memberships: { create: users.map((u, i) => ({ userId: u.id, role: i === 0 ? "owner" : "partner", displayLabel: i === 0 ? "A" : "B" })) },
    },
  });
  if (tokens) {
    await db.tokenLedgerEntry.create({ data: { profileId: p.id, delta: tokens, balanceAfter: tokens, kind: "admin_credit", idemKey: `seed:${p.id}` } });
    await db.communityProfile.update({ where: { id: p.id }, data: { tokenBalance: tokens } });
  }
  return p;
}

export async function connect(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  await db.connection.create({ data: { aId: x, bId: y } });
}
