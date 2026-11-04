"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { answerCallAction } from "@/app/actions/member/calls";
import type { ActionState } from "@/lib/actions";

interface Incoming { id: string; mode: string; from: string }

/** Hinweis auf eingehende Anrufe auf jeder Seite des Mitgliederbereichs (Polling alle 5 s). */
export function IncomingCall() {
  const [calls, setCalls] = useState<Incoming[]>([]);
  const path = usePathname();
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/app/anrufe/status", { cache: "no-store" });
        if (r.ok && !stop) setCalls(((await r.json()) as { incoming?: Incoming[] }).incoming ?? []);
      } catch {
        /* still */
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  if (!calls.length || path.startsWith("/app/anrufe/")) return null;
  const c = calls[0];
  return (
    <div className="incoming-call" role="alert" aria-live="assertive">
      <span>{c.mode === "video" ? "🎥" : "📞"} <strong>{c.from}</strong> ruft dich an</span>
      <span className="row">
        <Answer callId={c.id} accept label="Annehmen" cls="btn small" />
        <Answer callId={c.id} accept={false} label="Ablehnen" cls="btn secondary small" onDone={() => setCalls((x) => x.filter((y) => y.id !== c.id))} />
      </span>
    </div>
  );
}

function Answer({ callId, accept, label, cls, onDone }: { callId: string; accept: boolean; label: string; cls: string; onDone?: () => void }) {
  const [, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await answerCallAction(prev, fd);
    onDone?.();
    return r;
  }, {} as ActionState);
  return (
    <form action={action}>
      <input type="hidden" name="callId" value={callId} />
      <input type="hidden" name="accept" value={accept ? "1" : "0"} />
      <button className={cls} type="submit" disabled={pending}>{label}</button>
    </form>
  );
}
