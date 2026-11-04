import type { Metadata } from "next";
import Link from "next/link";
import { actingProfile } from "@/app/app/_lib/server";
import { joinCall } from "@/server/calls";
import { AppError } from "@/server/errors";
import { CallRoom } from "../CallRoom";

export const metadata: Metadata = { title: "Anruf" };
export const dynamic = "force-dynamic";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profileId } = await actingProfile();
  try {
    const j = await joinCall(userId, profileId, id);
    return (
      <div style={{ maxWidth: 980 }}>
        <CallRoom
          callId={j.callId} url={j.url} token={j.token} mode={j.mode} role={j.role} otherHandle={j.otherHandle}
          forceRelay={j.forceRelay} maxMinutes={j.maxMinutes} maxBitrateKbps={j.maxBitrateKbps} startedAt={j.startedAt}
        />
      </div>
    );
  } catch (e) {
    const msg = e instanceof AppError ? e.message : "Dieser Anruf ist nicht verfügbar.";
    return (
      <div className="stack" style={{ maxWidth: 680 }}>
        <h1>Anruf</h1>
        <p className="alert info">{msg}</p>
        <Link className="btn secondary" href="/app/anrufe">Zu den Anrufen</Link>
      </div>
    );
  }
}
