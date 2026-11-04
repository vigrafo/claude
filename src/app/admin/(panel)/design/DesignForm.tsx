"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Design-Einstellungen mit Live-Vorschau. Nur Farbe/Klartext – kein HTML/JS. */
export function DesignForm({ action, initial }: { action: Action; initial: { accent: string; tagline: string; maintenanceText: string } }) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [accent, setAccent] = useState(initial.accent);
  const [tagline, setTagline] = useState(initial.tagline);
  const valid = /^#[0-9a-fA-F]{6}$/.test(accent);
  return (
    <form action={formAction} className="stack" noValidate>
      <div aria-live="polite">
        {state.error && <div className="alert error" role="alert">{state.error}</div>}
        {state.ok && state.message && <div className="alert ok">{state.message}</div>}
      </div>
      <input type="hidden" name="key" value="design" />
      <input type="hidden" name="perm" value="design.manage" />
      <div className="row">
        <span className="admin-swatch" style={{ background: valid ? accent : "transparent" }} aria-label={`Vorschau Akzentfarbe ${accent}`} role="img" />
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem" }}>{tagline || "–"}</div>
          <span className="btn small" style={{ background: valid ? accent : undefined, pointerEvents: "none" }}>Beispiel-Button</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="accent">Akzentfarbe (Hex)</label>
        <div className="row">
          <input type="color" aria-label="Farbwähler" value={valid ? accent : "#000000"} onChange={(e) => setAccent(e.target.value)} style={{ width: 56, height: 44 }} />
          <input id="accent" name="v.accent" type="text" value={accent} onChange={(e) => setAccent(e.target.value)} aria-invalid={!valid} style={{ maxWidth: 160 }} />
        </div>
        {!valid && <p className="hint">Format: #RRGGBB</p>}
      </div>
      <div className="field">
        <label htmlFor="tagline">Claim (max. 80 Zeichen)</label>
        <input id="tagline" name="v.tagline" type="text" maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="mt">Wartungstext (max. 400 Zeichen)</label>
        <textarea id="mt" name="v.maintenanceText" maxLength={400} defaultValue={initial.maintenanceText} />
      </div>
      <div className="field">
        <label htmlFor="reason">Änderungsgrund</label>
        <input id="reason" name="reason" type="text" required minLength={3} />
      </div>
      <button className="btn" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Bitte warten …" : "Speichern (neue Version)"}</button>
    </form>
  );
}
