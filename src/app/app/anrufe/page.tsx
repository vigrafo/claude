import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { livekitConfigured } from "@/server/calls";
import { listConnections } from "@/server/contacts";
import { getSetting } from "@/server/settings";
import { db } from "@/server/db";
import { Avatar, Empty, Gate, formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { answerCallAction, endCallAction, startCallAction } from "@/app/actions/member/calls";

export const metadata: Metadata = { title: "Anrufe" };
export const dynamic = "force-dynamic";

export default async function Anrufe() {
  const { userId, profileId, v } = await actingProfile();
  if (!livekitConfigured()) {
    return (
      <div className="stack" style={{ maxWidth: 760 }}>
        <h1>Anrufe</h1>
        <p className="alert info">Anrufe sind auf diesem Server noch nicht eingerichtet. Sobald der Audio-/Videodienst verfügbar ist, kannst du hier mit deinen Kontakten telefonieren.</p>
      </div>
    );
  }
  const c = v.can("calls");
  if (!c.allowed) return (<div className="stack"><h1>Anrufe</h1><Gate reason={c.reason ?? "Anrufe sind in Premium und Gold enthalten."} cta={{ href: v.verified ? "/app/konto/tarif" : "/app/verifizierung", label: v.verified ? "Tarife ansehen" : "Jetzt verifizieren" }} /></div>);
  const [limits, contacts, calls] = await Promise.all([
    getSetting("calls.limits"),
    listConnections(userId, profileId),
    db.callSession.findMany({
      where: { status: { in: ["ringing", "active"] }, OR: [{ callerProfileId: profileId }, { calleeProfileId: profileId }] }, orderBy: { createdAt: "desc" },
    }),
  ]);
  const ids = [...new Set(calls.flatMap((x) => [x.callerProfileId, x.calleeProfileId]))];
  const handles = new Map((await db.communityProfile.findMany({ where: { id: { in: ids } }, select: { id: true, handle: true } })).map((p) => [p.id, p.handle]));
  const incoming = calls.filter((x) => x.calleeProfileId === profileId && x.status === "ringing");
  const ongoing = calls.filter((x) => !(x.calleeProfileId === profileId && x.status === "ringing"));
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <h1 style={{ margin: 0 }}>Anrufe</h1>
      <p className="muted" style={{ margin: 0 }}>
        Anrufe sind nur mit bestätigten Kontakten möglich, höchstens {limits.maxMinutes} Minuten. Kamera und Mikrofon werden nie automatisch eingeschaltet. Es gibt keine Aufzeichnung; die Verbindung ist transportverschlüsselt (keine Ende-zu-Ende-Verschlüsselung).
      </p>
      {incoming.length > 0 && (
        <section className="card stack" aria-labelledby="in-h" aria-live="polite">
          <h2 id="in-h">Eingehende Anrufe</h2>
          {incoming.map((x) => (
            <div key={x.id} className="row between">
              <span>{x.mode === "video" ? "🎥" : "📞"} {handles.get(x.callerProfileId) ?? "Kontakt"} · {formatDate(x.createdAt, true)}</span>
              <span className="row">
                <HiddenForm action={answerCallAction} fields={{ callId: x.id, accept: "1" }} submit="Annehmen" submitClass="btn small" />
                <HiddenForm action={answerCallAction} fields={{ callId: x.id, accept: "0" }} submit="Ablehnen" />
              </span>
            </div>
          ))}
        </section>
      )}
      {ongoing.length > 0 && (
        <section className="card stack" aria-labelledby="on-h">
          <h2 id="on-h">Laufende Anrufe</h2>
          {ongoing.map((x) => {
            const other = x.callerProfileId === profileId ? x.calleeProfileId : x.callerProfileId;
            return (
              <div key={x.id} className="row between">
                <span>{x.mode === "video" ? "🎥" : "📞"} {handles.get(other) ?? "Kontakt"} · {x.status === "ringing" ? "klingelt …" : "verbunden"}</span>
                <span className="row">
                  <a className="btn small" href={`/app/anrufe/${x.id}`}>{x.callerProfileId === profileId || x.status === "active" ? "Zum Anruf" : "Öffnen"}</a>
                  <HiddenForm action={endCallAction} fields={{ callId: x.id }} submit="Auflegen" submitClass="btn danger small" />
                </span>
              </div>
            );
          })}
          <p className="hint" style={{ margin: 0 }}>Das Anruffenster verbindet sich mit einem kurzlebigen, nur für diesen Raum gültigen Zugangsschlüssel.</p>
        </section>
      )}
      <section className="stack" aria-labelledby="ct-h">
        <h2 id="ct-h">Deine Kontakte</h2>
        {contacts.length === 0 ? <Empty title="Noch keine Kontakte">Anrufe sind möglich, sobald ihr eine Kontaktanfrage angenommen habt.</Empty> : contacts.map((ct) => (
          <div key={ct.id} className="card tight row between">
            <span className="row"><Avatar name={ct.other.handle} /> {ct.other.handle}</span>
            <span className="row">
              <HiddenForm action={startCallAction} fields={{ targetId: ct.other.id, mode: "audio" }} submit="📞 Audio" />
              {limits.videoEnabled && <HiddenForm action={startCallAction} fields={{ targetId: ct.other.id, mode: "video" }} submit="🎥 Video" />}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
