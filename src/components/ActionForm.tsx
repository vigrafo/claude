"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Formular mit zugänglicher Fehler-/Erfolgsanzeige (aria-live) und Sperre während des Sendens. */
export function ActionForm({
  action, children, submit = "Speichern", className, resetOnSuccess = false, submitClass = "btn", confirm,
}: {
  action: Action; children?: React.ReactNode; submit?: string; className?: string; resetOnSuccess?: boolean; submitClass?: string; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      noValidate
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <div aria-live="polite">
        {state.error && <div className="alert error" role="alert">{state.error}</div>}
        {state.ok && state.message && <div className="alert ok">{state.message}</div>}
      </div>
      {children}
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
        <ul className="alert error">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>{v}</li>
          ))}
        </ul>
      )}
      {submit && (
        <button className={submitClass} type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Bitte warten …" : submit}
        </button>
      )}
    </form>
  );
}
