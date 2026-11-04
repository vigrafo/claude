import { getViewer } from "@/lib/viewer";
import { exportOwnData } from "@/server/profiles";
import { rateLimit } from "@/server/ratelimit";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/** Datenexport ausschließlich für die angemeldete Person (keine Parameter, keine fremden IDs). */
export async function GET() {
  const v = await getViewer();
  if (!v || !v.user.emailVerifiedAt) return new Response("Nicht angemeldet", { status: 401 });
  try {
    await rateLimit("export_self", v.user.id, 5, 3600);
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.status });
    throw e;
  }
  const data = await exportOwnData(v.user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="eropub-datenexport-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
