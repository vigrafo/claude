import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getViewer } from "@/lib/viewer";
import { canViewMedia } from "@/server/media";

export const dynamic = "force-dynamic";

/** Liefert ein Medium nur nach Rechteprüfung (aktive Mitgliedschaft, Moderation, Sichtbarkeit, Blockierung). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getViewer();
  if (!v || !v.profileRow || !v.user.emailVerifiedAt) return new Response("Nicht angemeldet", { status: 401 });
  const asset = await canViewMedia(v.user.id, v.profileRow.id, id).catch(() => null);
  if (!asset) return new Response("Nicht gefunden", { status: 404 });
  if (!process.env.S3_ENDPOINT || !process.env.S3_BUCKET) return new Response("Speicher nicht konfiguriert", { status: 503 });
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? "eu-central-1", forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? "", secretAccessKey: process.env.S3_SECRET_KEY ?? "" },
  });
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.storageKey }));
    const body = obj.Body?.transformToWebStream();
    if (!body) return new Response("Nicht gefunden", { status: 404 });
    return new Response(body, {
      headers: {
        "Content-Type": asset.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("Nicht gefunden", { status: 404 });
  }
}
