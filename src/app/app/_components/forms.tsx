import { ActionForm } from "@/components/ActionForm";
import type { ActionState } from "@/lib/actions";
import { reportAction } from "@/app/actions/member/contacts";
import { REPORT_REASONS } from "@/app/app/_lib/options";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Ein-Klick-Formular mit versteckten Feldern (z. B. Annehmen, Favorit, Blockieren). */
export function HiddenForm({
  action, fields, submit, submitClass = "btn secondary small", confirm, children,
}: {
  action: Action; fields: Record<string, string>; submit: string; submitClass?: string; confirm?: string; children?: React.ReactNode;
}) {
  return (
    <ActionForm action={action} submit={submit} submitClass={submitClass} confirm={confirm}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </ActionForm>
  );
}

/** Melden: Grund + optionale Details; erzeugt/ergänzt einen Moderationsfall. */
export function ReportForm({ targetType, targetId, label = "Melden" }: { targetType: string; targetId: string; label?: string }) {
  const id = `rep-${targetType}-${targetId}`;
  return (
    <details>
      <summary className="btn ghost small">{label}</summary>
      <div className="card tight" style={{ marginTop: 8 }}>
        <ActionForm action={reportAction} submit="Meldung senden" submitClass="btn danger small" resetOnSuccess>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <div className="field">
            <label htmlFor={`${id}-reason`}>Grund</label>
            <select id={`${id}-reason`} name="reason" required defaultValue="">
              <option value="" disabled>Bitte wählen</option>
              {REPORT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-details`}>Details (optional)</label>
            <textarea id={`${id}-details`} name="details" rows={3} aria-describedby={`${id}-hint`} />
            <p className="hint" id={`${id}-hint`}>Höchstens 2000 Zeichen. Die gemeldete Person erfährt nicht, wer gemeldet hat.</p>
          </div>
        </ActionForm>
      </div>
    </details>
  );
}
