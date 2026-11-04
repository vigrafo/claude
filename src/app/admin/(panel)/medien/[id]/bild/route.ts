import { adminGuard } from "@/app/admin/_lib/guard";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/**
 * Vorschau für die Medienmoderation (Recht media.moderate). Chatbilder sind ausgenommen –
 * sie sind nur fallbezogen über Moderationsfälle mit Recht moderation.evidence einsehbar.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminGuard("media.moderate");
  const { id } = await params;
  const m = await db.mediaAsset.findUnique({ where: { id } });
  if (!m || m.purpose === "message") return new Response("Nicht gefunden", { status: 404 });
  const data = await storage().get(m.storageKey);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  await audit("media.moderation_view", { actorUserId: admin.user.id, targetType: "media", targetId: m.id });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": m.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
