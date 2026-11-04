"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/actions";
import { EMOJI_PICKER, GIFT_NOTE_MAX, MESSAGE_MAX } from "@/domain/messaging";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export interface GiftOption { key: string; label: string; emoji: string; tokenCost: number }

/**
 * Nachrichteneingabe: Kosten VOR dem Senden, Zeichenzähler (zu lange Texte werden abgewiesen, nie gekürzt),
 * Emoji-Auswahl, Geschenke und ein pro Absenden neu erzeugter Idempotenzschlüssel.
 */
export function MessageComposer({
  action, hidden, costPerMessage, balance, gifts, requestNote,
}: {
  action: Action; hidden: Record<string, string>; costPerMessage: number; balance: number; gifts: GiftOption[]; requestNote?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [body, setBody] = useState("");
  const [gift, setGift] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      setBody("");
      setGift("");
    }
  }, [state]);

  const selected = gifts.find((g) => g.key === gift);
  const max = selected ? GIFT_NOTE_MAX : MESSAGE_MAX;
  const len = [...body].length;
  const tooLong = len > max;
  const cost = costPerMessage + (selected?.tokenCost ?? 0);
  const insufficient = cost > balance;
  const emptyText = !selected && body.trim().length === 0;

  function insert(e: string) {
    const el = ta.current;
    if (!el) return setBody((b) => b + e);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + e + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + e.length, start + e.length);
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="card stack"
      onSubmit={(e) => {
        if (tooLong || emptyText || insufficient) {
          e.preventDefault();
          return;
        }
        if (keyRef.current) keyRef.current.value = crypto.randomUUID();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input ref={keyRef} type="hidden" name="clientKey" defaultValue="" />
      <input type="hidden" name="kind" value={selected ? "gift" : "text"} />
      <input type="hidden" name="giftKey" value={gift} />
      <div aria-live="polite">
        {state.error && <div className="alert error" role="alert">{state.error}</div>}
        {state.ok && state.message && <div className="alert ok">{state.message}</div>}
      </div>
      {requestNote && <p className="alert info" style={{ margin: 0 }}>{requestNote}</p>}
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="msg-body">{selected ? "Notiz zum Geschenk (optional)" : "Deine Nachricht"}</label>
        <textarea
          id="msg-body" ref={ta} name="body" value={body} onChange={(e) => setBody(e.target.value)}
          aria-invalid={tooLong} aria-describedby="msg-count msg-cost" rows={4}
        />
        <p id="msg-count" className={tooLong ? "hint" : "hint"} style={tooLong ? { color: "var(--danger)" } : undefined}>
          {len} / {max} Zeichen{tooLong ? ` – bitte kürze deinen Text um ${len - max} Zeichen. Wir kürzen nichts automatisch.` : ""}
        </p>
      </div>
      <div className="row between">
        <div className="row">
          <button type="button" className="btn ghost small" aria-expanded={showEmoji} aria-controls="emoji-panel" onClick={() => setShowEmoji((s) => !s)}>
            😊 Emojis
          </button>
          {gifts.length > 0 && (
            <label className="row" style={{ margin: 0, fontWeight: 400 }}>
              <span className="sr-only">Virtuelles Geschenk</span>
              <select value={gift} onChange={(e) => setGift(e.target.value)} aria-label="Virtuelles Geschenk" style={{ width: "auto" }}>
                <option value="">Kein Geschenk</option>
                {gifts.map((g) => <option key={g.key} value={g.key}>{g.emoji} {g.label} · {g.tokenCost} Token</option>)}
              </select>
            </label>
          )}
        </div>
        <p id="msg-cost" className="muted" style={{ margin: 0 }}>
          {cost === 0 ? "ohne Tokenkosten" : `Kosten: ${cost} ${cost === 1 ? "Token" : "Tokens"}`} · Guthaben: {balance}
        </p>
      </div>
      {showEmoji && (
        <div id="emoji-panel" className="emoji-grid" role="group" aria-label="Emoji einfügen">
          {EMOJI_PICKER.map((e) => <button key={e} type="button" onClick={() => insert(e)} aria-label={`Emoji ${e} einfügen`}>{e}</button>)}
        </div>
      )}
      {insufficient && (
        <p className="alert warn" style={{ margin: 0 }}>Dein Guthaben reicht nicht. <a href="/app/konto/tokens">Tokens kaufen</a> oder mit Premium ohne Tokenkosten schreiben.</p>
      )}
      <div>
        <button className="btn" type="submit" disabled={pending || tooLong || emptyText || insufficient} aria-busy={pending}>
          {pending ? "Wird gesendet …" : selected ? "Geschenk senden" : "Senden"}
        </button>
      </div>
    </form>
  );
}
