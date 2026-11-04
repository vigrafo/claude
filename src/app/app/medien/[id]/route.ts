import { getViewer } from "@/lib/viewer";
import { canViewMedia } from "@/server/media";
import { storage } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Liefert ein Medium nur nach Rechteprüfung (aktive Mitgliedschaft, Moderation, Sichtbarkeit, Blockierung). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  if (!v || !v.profileRow || !v.user.emailVerifiedAt) return new Response("Nicht angemeldet", { status: 401 });
  const asset = await canViewMedia(v.user.id, v.profileRow.id, id).catch(() => null);
  if (!asset) return new Response("Nicht gefunden", { status: 404 });
  const data = await storage().get(asset.storageKey);
  if (!data) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline", "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
