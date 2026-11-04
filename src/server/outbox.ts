import { db, type Tx } from "./db";

/** Transaktionale Outbox: Ereignisse werden mit der fachlichen Änderung geschrieben und vom Worker zugestellt. */
export async function enqueue(tx: Tx, topic: string, payload: Record<string, unknown>, delayMs = 0) {
  return tx.outboxEvent.create({ data: { topic, payload: payload as object, availableAt: new Date(Date.now() + delayMs) } });
}

export type Handler = (payload: Record<string, unknown>) => Promise<void>;

/** Holt Ereignisse mit FOR UPDATE SKIP LOCKED – mehrere Worker parallel möglich. */
export async function processOutboxBatch(handlers: Record<string, Handler>, batch = 20): Promise<number> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "OutboxEvent" SET attempts = attempts + 1, "availableAt" = now() + interval '2 minutes'
    WHERE id IN (
      SELECT id FROM "OutboxEvent" WHERE status = 'pending' AND "availableAt" <= now()
      ORDER BY "availableAt" LIMIT ${batch} FOR UPDATE SKIP LOCKED
    ) RETURNING id`;
  for (const { id } of rows) {
    const ev = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
    const h = handlers[ev.topic];
    try {
      if (h) await h(ev.payload as Record<string, unknown>);
      await db.outboxEvent.update({ where: { id }, data: { status: "done", doneAt: new Date(), lastError: null } });
    } catch (e) {
      const failed = ev.attempts >= 8;
      await db.outboxEvent.update({
        where: { id },
        data: {
          status: failed ? "failed" : "pending",
          lastError: String((e as Error).message).slice(0, 500),
          availableAt: new Date(Date.now() + Math.min(3600, 2 ** ev.attempts * 5) * 1000),
        },
      });
    }
  }
  return rows.length;
}
