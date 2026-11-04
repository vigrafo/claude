import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { viewSession } from "@/server/games";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm } from "@/app/app/_components/forms";
import { confirmAnswersAction, consentContactAction, consentJoinAction, saveAnswersAction } from "@/app/actions/member/games";
import { GAME_VARIANTS, requiredHits, resultText, type GameRules, type GameVariant } from "@/domain/games";
import { SESSION_STATUS } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Kennenlernspiel" };

export default async function SpielRunde({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profileId, v } = await actingProfile();
  let s;
  try {
    s = await viewSession(userId, id, profileId);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const other = s.otherProfileId ? await db.communityProfile.findUnique({ where: { id: s.otherProfileId }, select: { handle: true } }) : null;
  const myCount = await db.profileMembership.count({ where: { profileId, status: "active" } });
  const joins = s.myConfirmations.filter((c) => c.kind === "join");
  const iJoined = joins.some((c) => c.userId === userId);
  const answerConfirms = s.myConfirmations.filter((c) => c.kind === "answers");
  const iConfirmed = answerConfirms.some((c) => c.userId === userId);
  const iContact = s.myConfirmations.some((c) => c.kind === "contact" && c.userId === userId);
  const rules = s.rules as unknown as GameRules;
  const allQ = [...s.questions, ...s.reserve];
  const answers = s.myAnswers as Record<string, string | null>;
  const skipped = s.questions.filter((q) => q.key in answers && answers[q.key] === null).length;
  const shownReserve = s.reserve.slice(0, Math.max(skipped, s.reserve.filter((q) => q.key in answers).length));
  const answered = s.questions.filter((q) => answers[q.key] != null).length;
  const contactCount = s.result?.isMatch
    ? await db.gamePersonConsent.count({ where: { kind: "contact", participant: { sessionId: s.id } } })
    : 0;
  const result = s.result
    ? {
        status: s.result.isMatch ? ("match" as const) : s.incomplete ? ("incomplete" as const) : ("no_match" as const),
        answeredBoth: s.result.answeredBoth, hits: s.result.hits, requiredHits: requiredHits(s.result.answeredBoth, rules.thresholdBp), sharedKeys: s.result.sharedKeys,
      }
    : null;
  const variant = GAME_VARIANTS[s.variant as GameVariant];

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div>
        <Link href="/app/spiele" className="dim">← Spiele</Link>
        <h1 style={{ margin: "4px 0 0" }}>{variant?.title ?? "Kennenlernspiel"}</h1>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="badge neutral">{SESSION_STATUS[s.status] ?? s.status}</span>
          <span className="muted">mit {other?.handle ?? "einem Paar"} · gültig bis {formatDate(s.expiresAt, true)}</span>
        </div>
      </div>

      {(s.status === "invited" || s.status === "accepted") && (
        <section className="card stack" aria-labelledby="join-h">
          <h2 id="join-h">Teilnahme</h2>
          <p className="muted" style={{ margin: 0 }}>Jede Person stimmt selbst zu. Los geht&apos;s, wenn alle vier Personen dabei sind. Bisher von euch: {joins.length}/{myCount}. Anderes Paar: {s.otherStatus === "answering" ? "beide dabei" : "noch offen"}.</p>
          {iJoined ? <p className="alert ok" style={{ margin: 0 }}>Du hast zugestimmt.</p> : (
            <div className="row">
              <HiddenForm action={consentJoinAction} fields={{ sessionId: s.id, accept: "1" }} submit="Ich bin dabei" submitClass="btn" />
              <HiddenForm action={consentJoinAction} fields={{ sessionId: s.id, accept: "0" }} submit="Ablehnen" confirm="Einladung für euer Paar ablehnen?" />
            </div>
          )}
        </section>
      )}

      {s.status === "answering" && s.myStatus !== "submitted" && (
        <>
          <section className="card stack" aria-labelledby="prog-h">
            <h2 id="prog-h">Fortschritt</h2>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={s.questions.length} aria-valuenow={answered} aria-label="Beantwortete Fragen">
              <span style={{ width: `${(answered / Math.max(1, s.questions.length)) * 100}%` }} />
            </div>
            <p className="muted" style={{ margin: 0 }}>{answered} von {s.questions.length} Fragen beantwortet{skipped ? `, ${skipped} übersprungen` : ""}. Ihr beantwortet die Fragen gemeinsam als Paar – Änderungen sieht auch deine Partnerperson.</p>
          </section>
          <ActionForm action={saveAnswersAction} submit="Antworten speichern" className="stack">
            <input type="hidden" name="sessionId" value={s.id} />
            {[...s.questions, ...shownReserve].map((q, i) => (
              <fieldset key={q.key} className="card">
                <legend>{i >= s.questions.length ? "Zusatzfrage: " : `${i + 1}. `}{q.text}</legend>
                {q.options.map((o) => (
                  <label key={o.key} className="check"><input type="radio" name={`q_${q.key}`} value={o.key} defaultChecked={answers[q.key] === o.key} /> {o.label}</label>
                ))}
                <label className="check"><input type="radio" name={`q_${q.key}`} value="__skip" defaultChecked={q.key in answers && answers[q.key] === null} /> Überspringen</label>
              </fieldset>
            ))}
          </ActionForm>
          <section className="card stack" aria-labelledby="conf-h">
            <h2 id="conf-h">Antworten bestätigen</h2>
            <p className="muted" style={{ margin: 0 }}>
              Beide Personen eures Paars bestätigen dieselbe Antwortversion. Jede Änderung setzt die Bestätigungen zurück. Nach beiden Bestätigungen sind eure Antworten gesperrt. Bestätigt: {answerConfirms.length}/{myCount}.
            </p>
            {iConfirmed ? <p className="alert ok" style={{ margin: 0 }}>Du hast diese Version bestätigt. Jetzt fehlt noch deine Partnerperson.</p>
              : <HiddenForm action={confirmAnswersAction} fields={{ sessionId: s.id }} submit="Antworten bestätigen" submitClass="btn" />}
          </section>
        </>
      )}

      {s.status === "answering" && s.myStatus === "submitted" && (
        <p className="alert info">Eure Antworten sind abgegeben. Wir warten auf das andere Paar.</p>
      )}

      {s.status === "completed" && result && (
        <section className="card stack" aria-labelledby="res-h">
          <h2 id="res-h">Ergebnis</h2>
          <p style={{ fontSize: "1.15rem", margin: 0 }}>{resultText(result)}</p>
          {result.sharedKeys.length > 0 && (
            <>
              <h3>Hier seid ihr euch einig</h3>
              <ul className="checks">{result.sharedKeys.map((k) => <li key={k}>{allQ.find((q) => q.key === k)?.text ?? k}</li>)}</ul>
            </>
          )}
          {result.status === "match" && (
            <div className="stack">
              <p className="muted" style={{ margin: 0 }}>Ein Fragen-Match ist nur ein Vorschlag. Ihr werdet erst verbunden, wenn alle vier Personen zustimmen. Zustimmungen: {contactCount}/4.</p>
              {contactCount >= 4 ? <p className="alert ok" style={{ margin: 0 }}>Ihr seid verbunden. <Link href={`/app/nachrichten/neu?an=${encodeURIComponent(other?.handle ?? "")}`}>Nachricht schreiben</Link> – es gelten die normalen Regeln eures Tarifs.</p>
                : iContact ? <p className="alert ok" style={{ margin: 0 }}>Du hast zugestimmt.</p>
                : <HiddenForm action={consentContactAction} fields={{ sessionId: s.id }} submit="Kontakt zustimmen" submitClass="btn" />}
            </div>
          )}
        </section>
      )}

      {["declined", "expired", "cancelled"].includes(s.status) && (
        <p className="alert info">Diese Runde ist beendet ({SESSION_STATUS[s.status]}).</p>
      )}
      {!v.can("games").allowed && <p className="alert warn">{v.can("games").reason}</p>}
    </div>
  );
}
