import { NextResponse } from "next/server";
import { getViewer } from "@/lib/viewer";
import { callStatus, livekitConfigured } from "@/server/calls";

export const dynamic = "force-dynamic";

/** Polling-Endpunkt: nur Metadaten (Status, Pseudonym der anrufenden Person), keine Inhalte. */
export async function GET(req: Request) {
  const v = await getViewer();
  if (!v || !v.profileRow || !v.user.emailVerifiedAt) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!livekitConfigured()) return NextResponse.json({ incoming: [] });
  const callId = new URL(req.url).searchParams.get("call") ?? undefined;
  try {
    const r = await callStatus(v.user.id, v.profileRow.id, callId);
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}
