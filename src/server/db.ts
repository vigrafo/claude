import { PrismaClient, Prisma } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const db: PrismaClient =
  g.__prisma ?? new PrismaClient({ log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") g.__prisma = db;

export type Tx = Prisma.TransactionClient;
export { Prisma };

/** Serialisierbare Transaktion mit Wiederholung bei Konflikten (P2034 / 40001). */
export async function serializable<T>(fn: (tx: Tx) => Promise<T>, retries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (e) {
      const code = (e as { code?: string }).code;
      const msg = String((e as Error).message ?? "");
      if (i < retries && (code === "P2034" || msg.includes("40001") || msg.includes("could not serialize"))) {
        await new Promise((r) => setTimeout(r, 15 * (i + 1) + Math.random() * 20));
        continue;
      }
      throw e;
    }
  }
}

export function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "P2002";
}
