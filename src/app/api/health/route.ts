import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Healthcheck für Monitoring/Container – ohne personenbezogene Daten. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const [pending, failed] = await Promise.all([
      db.outboxEvent.count({ where: { status: "pending" } }),
      db.outboxEvent.count({ where: { status: "failed" } }),
    ]);
    return NextResponse.json({ status: "ok", db: "ok", outbox: { pending, failed }, ms: Date.now() - started, release: process.env.APP_RELEASE ?? "dev" });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }
}
