"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState, DisconnectReason, Room, RoomEvent, Track, type LocalTrackPublication, type RemoteTrack, type RemoteParticipant,
} from "livekit-client";
import { hangupCall, reportCallProblem } from "@/app/actions/member/calls";

export interface CallRoomProps {
  callId: string;
  url: string;
  token: string;
  mode: "audio" | "video";
  role: "caller" | "callee";
  otherHandle: string;
  forceRelay: boolean;
  maxMinutes: number;
  maxBitrateKbps: number;
  startedAt: string;
}

type Phase = "idle" | "connecting" | "waiting" | "connected" | "reconnecting" | "ended" | "error";

/**
 * Anruffenster. Kamera und Mikrofon werden NIE automatisch eingeschaltet – nur per ausdrücklichem Klick.
 * Transportverschlüsselt über LiveKit (DTLS-SRTP); keine Ende-zu-Ende-Verschlüsselung, keine Aufzeichnung.
 */
export function CallRoom(p: CallRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const remoteVideo = useRef<HTMLDivElement>(null);
  const remoteAudio = useRef<HTMLDivElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("");
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [remotePresent, setRemotePresent] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(p.maxMinutes * 60);
  const ended = useRef(false);

  const finish = useCallback((text: string, ph: Phase = "ended") => {
    ended.current = true;
    setPhase(ph);
    setStatus(text);
    roomRef.current?.disconnect().catch(() => undefined);
    roomRef.current = null;
    setMicOn(false);
    setCamOn(false);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      setMics(await Room.getLocalDevices("audioinput"));
      setCams(p.mode === "video" ? await Room.getLocalDevices("videoinput") : []);
      setSpeakers(await Room.getLocalDevices("audiooutput"));
    } catch {
      /* Geräteliste ohne Freigabe ggf. leer */
    }
  }, [p.mode]);

  const connect = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    setStatus("Verbinde …");
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { videoEncoding: { maxBitrate: p.maxBitrateKbps * 1000, maxFramerate: 30 } },
    });
    roomRef.current = room;

    const attachRemote = (track: RemoteTrack) => {
      const el = track.attach();
      el.setAttribute("data-track", track.sid ?? "");
      if (track.kind === Track.Kind.Video) {
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.objectFit = "cover";
        el.setAttribute("aria-label", `Video von ${p.otherHandle}`);
        remoteVideo.current?.replaceChildren(el);
        setRemoteHasVideo(true);
      } else {
        remoteAudio.current?.appendChild(el);
      }
    };

    room
      .on(RoomEvent.TrackSubscribed, (track) => attachRemote(track))
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        if (track.kind === Track.Kind.Video) setRemoteHasVideo(false);
      })
      .on(RoomEvent.TrackMuted, (pub, participant) => {
        if (participant !== room.localParticipant && pub.kind === Track.Kind.Video) setRemoteHasVideo(false);
      })
      .on(RoomEvent.TrackUnmuted, (pub, participant) => {
        if (participant !== room.localParticipant && pub.kind === Track.Kind.Video) setRemoteHasVideo(true);
      })
      .on(RoomEvent.ParticipantConnected, (_rp: RemoteParticipant) => {
        setRemotePresent(true);
        setPhase("connected");
        setStatus(`Verbunden mit ${p.otherHandle}`);
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        setRemotePresent(false);
        setRemoteHasVideo(false);
        if (!ended.current) finish(`${p.otherHandle} hat aufgelegt.`);
      })
      .on(RoomEvent.Reconnecting, () => {
        setPhase("reconnecting");
        setStatus("Verbindung unterbrochen – verbinde neu …");
      })
      .on(RoomEvent.Reconnected, () => {
        setPhase(room.remoteParticipants.size ? "connected" : "waiting");
        setStatus(room.remoteParticipants.size ? `Verbunden mit ${p.otherHandle}` : "Es klingelt …");
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (ended.current) return;
        const text =
          reason === DisconnectReason.ROOM_DELETED ? "Der Anruf wurde beendet."
          : reason === DisconnectReason.PARTICIPANT_REMOVED ? "Du wurdest aus dem Anruf entfernt."
          : "Die Verbindung wurde getrennt.";
        finish(text);
      })
      .on(RoomEvent.MediaDevicesChanged, refreshDevices)
      .on(RoomEvent.MediaDevicesError, (e: Error) => setError(deviceErrorText(e)));

    try {
      await room.connect(p.url, p.token, {
        autoSubscribe: true,
        rtcConfig: p.forceRelay ? { iceTransportPolicy: "relay" } : undefined,
      });
      await refreshDevices();
      const others = room.remoteParticipants.size > 0;
      setRemotePresent(others);
      setPhase(others ? "connected" : "waiting");
      setStatus(others ? `Verbunden mit ${p.otherHandle}` : p.role === "caller" ? `Es klingelt bei ${p.otherHandle} …` : `Warte auf ${p.otherHandle} …`);
      room.remoteParticipants.forEach((rp) =>
        rp.trackPublications.forEach((pub) => {
          if (pub.track && pub.isSubscribed) attachRemote(pub.track as RemoteTrack);
        }),
      );
    } catch (e) {
      setPhase("error");
      setStatus("Verbindung fehlgeschlagen.");
      setError("Die Verbindung zum Anrufdienst ist fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut.");
      await reportCallProblem(p.callId, "connect_failed").catch(() => undefined);
      roomRef.current = null;
      void e;
    }
  }, [p, finish, refreshDevices]);

  // Zustand des Anrufs serverseitig verfolgen (Ablehnung, verpasst, Rechteentzug)
  useEffect(() => {
    if (phase === "ended" || phase === "error" || phase === "idle") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/app/anrufe/status?call=${encodeURIComponent(p.callId)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { call?: { status: string; text: string } };
        if (j.call && j.call.status !== "ringing" && j.call.status !== "active" && !ended.current) finish(j.call.text);
      } catch {
        /* nächster Versuch */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [phase, p.callId, finish]);

  // Maximale Gesprächsdauer sichtbar machen und einhalten
  useEffect(() => {
    if (phase !== "connected") return;
    const end = new Date(p.startedAt).getTime() + p.maxMinutes * 60_000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void hangup("Die maximale Gesprächsdauer ist erreicht.");
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, p.startedAt, p.maxMinutes]);

  useEffect(() => () => { roomRef.current?.disconnect().catch(() => undefined); }, []);

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    setError(null);
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
      await refreshDevices();
    } catch (e) {
      setError(deviceErrorText(e as Error));
    }
  }

  async function toggleCam() {
    const room = roomRef.current;
    if (!room) return;
    setError(null);
    try {
      const pub = (await room.localParticipant.setCameraEnabled(!camOn)) as LocalTrackPublication | undefined;
      setCamOn(!camOn);
      if (!camOn && pub?.track && localVideo.current) pub.track.attach(localVideo.current);
      await refreshDevices();
    } catch (e) {
      // Audio-Fallback: Gespräch läuft ohne Kamera weiter
      setCamOn(false);
      setError(`${deviceErrorText(e as Error)} Das Gespräch läuft ohne Kamera weiter.`);
    }
  }

  async function switchDevice(kind: MediaDeviceKind, id: string) {
    try {
      await roomRef.current?.switchActiveDevice(kind, id);
    } catch (e) {
      setError(deviceErrorText(e as Error));
    }
  }

  async function hangup(text = "Du hast aufgelegt.") {
    finish(text);
    await hangupCall(p.callId).catch(() => undefined);
  }

  const active = phase === "connected" || phase === "waiting" || phase === "reconnecting";
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>{p.mode === "video" ? "Videoanruf" : "Audioanruf"} mit {p.otherHandle}</h1>
        {phase === "connected" && <span className="badge neutral" aria-label={`Restzeit ${mm} Minuten ${ss} Sekunden`}>⏱ {mm}:{ss}</span>}
      </div>
      <p className="muted" role="status" aria-live="polite" style={{ margin: 0 }}>{status || "Bereit. Tritt dem Anruf bei, wenn du so weit bist."}</p>
      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="call-stage">
        {/* Eigener, von React NICHT verwalteter Knoten für das LiveKit-Videoelement */}
        <div className="call-remote" ref={remoteVideo} aria-label="Gegenseite" />
        <div className="call-overlay">
          {!remoteHasVideo && (
            <div className="call-placeholder">
              <span className="avatar lg" aria-hidden="true">{p.otherHandle.slice(0, 2).toUpperCase()}</span>
              <span className="muted">{remotePresent ? (p.mode === "video" ? "Kamera der Gegenseite ist aus" : "Audioanruf") : "Noch nicht verbunden"}</span>
            </div>
          )}
        </div>
        {p.mode === "video" && (
          <video ref={localVideo} className="call-local" muted playsInline autoPlay aria-label="Deine Kameravorschau" hidden={!camOn} />
        )}
      </div>
      <div ref={remoteAudio} hidden />

      {phase === "idle" || phase === "error" ? (
        <div className="row">
          <button className="btn" type="button" onClick={connect}>{phase === "error" ? "Erneut verbinden" : "Anruf beitreten"}</button>
          <button className="btn secondary" type="button" onClick={() => hangup("Anruf beendet.")}>Abbrechen</button>
        </div>
      ) : active ? (
        <div className="call-controls" role="toolbar" aria-label="Anrufsteuerung">
          <button className="btn secondary" type="button" aria-pressed={micOn} onClick={toggleMic}>{micOn ? "🎙 Mikrofon aus" : "🎙 Mikrofon einschalten"}</button>
          {p.mode === "video" && (
            <button className="btn secondary" type="button" aria-pressed={camOn} onClick={toggleCam}>{camOn ? "📷 Kamera aus" : "📷 Kamera einschalten"}</button>
          )}
          <button className="btn danger" type="button" onClick={() => hangup()}>Auflegen</button>
        </div>
      ) : (
        <div className="row"><a className="btn secondary" href="/app/anrufe">Zurück zu den Anrufen</a></div>
      )}

      {active && (mics.length > 0 || cams.length > 0 || speakers.length > 0) && (
        <details className="card tight">
          <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>Geräte wählen</summary>
          <div className="grid grid-3" style={{ marginTop: 12 }}>
            {mics.length > 0 && <DeviceSelect id="dev-mic" label="Mikrofon" devices={mics} onChange={(id) => switchDevice("audioinput", id)} />}
            {cams.length > 0 && <DeviceSelect id="dev-cam" label="Kamera" devices={cams} onChange={(id) => switchDevice("videoinput", id)} />}
            {speakers.length > 0 && <DeviceSelect id="dev-out" label="Lautsprecher" devices={speakers} onChange={(id) => switchDevice("audiooutput", id)} />}
          </div>
        </details>
      )}

      <p className="hint" style={{ margin: 0 }}>
        Kamera und Mikrofon schaltest nur du selbst ein. Es gibt keine Aufzeichnung. Die Verbindung ist transportverschlüsselt
        {p.forceRelay ? " und läuft über unseren Relay-Server, damit deine IP-Adresse der Gegenseite verborgen bleibt" : ""}. Höchstdauer: {p.maxMinutes} Minuten.
      </p>
    </div>
  );
}

function DeviceSelect({ id, label, devices, onChange }: { id: string; label: string; devices: MediaDeviceInfo[]; onChange: (id: string) => void }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label htmlFor={id}>{label}</label>
      <select id={id} onChange={(e) => onChange(e.target.value)} defaultValue="">
        <option value="" disabled>Bitte wählen</option>
        {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
      </select>
    </div>
  );
}

function deviceErrorText(e: Error): string {
  const name = (e as { name?: string }).name ?? "";
  if (name === "NotAllowedError" || /permission/i.test(e.message)) return "Der Zugriff auf Kamera oder Mikrofon wurde verweigert. Du kannst ihn in den Browsereinstellungen erlauben.";
  if (name === "NotFoundError") return "Kein passendes Gerät gefunden.";
  if (name === "NotReadableError") return "Das Gerät wird gerade von einer anderen Anwendung verwendet.";
  return "Kamera oder Mikrofon konnten nicht gestartet werden.";
}
