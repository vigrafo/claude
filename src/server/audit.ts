import { db, type Tx } from "./db";
import { sha256 } from "./crypto";

/** Hashverkettetes Audit-Protokoll (manipulationserschwert). Keine sensiblen Inhalte in meta! */
export async function audit(
  action: string,
  opts: { actorUserId?: string | null; targetType?: string; targetId?: string; meta?: Record<string, unknown> } = {},
  tx: Tx = db,
): Promise<void> {
  if (tx === db) {
    await db.$transaction((t) => audit(action, opts, t));
    return;
  }
  // Serialisiert die Kette über eine transaktionsgebundene Advisory-Sperre.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(727274)`;
  const prev = await tx.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const createdAt = new Date();
  const meta = redact(opts.meta ?? {});
  const hash = chainHash(prev?.hash ?? null, action, opts.actorUserId ?? null, opts.targetType ?? null, opts.targetId ?? null, meta, createdAt);
  await tx.auditEvent.create({
    data: {
      action, actorUserId: opts.actorUserId ?? null, targetType: opts.targetType, targetId: opts.targetId,
      meta: meta as object, prevHash: prev?.hash ?? null, hash, createdAt,
    },
  });
}

const SENSITIVE = /(password|secret|token|body|text|document|iban|card|answer)/i;
export function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) out[k] = SENSITIVE.test(k) ? "[redacted]" : v;
  return out;
}

export async function verifyAuditChain(limit = 5000): Promise<{ ok: boolean; brokenAt?: string }> {
  const rows = await db.auditEvent.findMany({ orderBy: { seq: "asc" }, take: limit });
  let prev: string | null = null;
  for (const r of rows) {
    const h = chainHash(prev, r.action, r.actorUserId, r.targetType, r.targetId, r.meta, r.createdAt);
    if (h !== r.hash || r.prevHash !== prev) return { ok: false, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true };
}

/** Kanonische Serialisierung (sortierte Schlüssel) – jsonb ändert die Schlüsselreihenfolge. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

function chainHash(
  prev: string | null, action: string, actor: string | null, tt: string | null, tid: string | null, meta: unknown, at: Date,
): string {
  return sha256(canonical([prev, action, actor, tt, tid, meta, at.toISOString()]));
}
