/**
 * eropub Worker – separater Prozess (`npm run worker`).
 * - Outbox-Zustellung (Benachrichtigungen, Admin-Mails, Raumentzug) mit Retries
 * - periodische Jobs: Löschläufe, Verifizierungsablauf, Belegbereinigung, Preis-Hinweise, Abos, Spiele, Tickets
 * Mehrere Instanzen sind möglich (SKIP LOCKED); periodische Jobs laufen nur mit Advisory-Lock.
 * Optionen: --once (ein Durchlauf, z. B. für Cron/Tests), --reapply-deletions (nach Backup-Restore).
 */
import { db } from "../src/server/db";
import { handlers, processOutboxBatch, reapplyDeletions, runPeriodic } from "../src/server/jobs";

const args = new Set(process.argv.slice(2));
let stopping = false;

async function periodicWithLock() {
  const [{ locked }] = await db.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(424242) AS locked`;
  if (!locked) return;
  try {
    const r = await runPeriodic();
    const nonZero = Object.entries(r).filter(([, v]) => v);
    if (nonZero.length) console.info(`[worker] periodic ${JSON.stringify(Object.fromEntries(nonZero))}`);
  } finally {
    await db.$queryRaw`SELECT pg_advisory_unlock(424242)`;
  }
}

async function main() {
  if (args.has("--reapply-deletions")) {
    const n = await reapplyDeletions();
    console.info(`[worker] Löschungen erneut angewendet: ${n}`);
    return;
  }
  if (args.has("--once")) {
    await processOutboxBatch(handlers, 100);
    await periodicWithLock();
    return;
  }
  console.info("[worker] gestartet");
  let lastPeriodic = 0;
  while (!stopping) {
    try {
      const n = await processOutboxBatch(handlers, 50);
      if (Date.now() - lastPeriodic > 60_000) {
        await periodicWithLock();
        lastPeriodic = Date.now();
      }
      if (n === 0) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error("[worker] Fehler:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopping = true;
    console.info(`[worker] ${sig} – beende nach aktuellem Durchlauf`);
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
