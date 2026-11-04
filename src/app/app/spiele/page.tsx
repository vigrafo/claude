import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { Empty, Gate, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { inviteGameAction } from "@/app/actions/member/games";
import { GAME_VARIANTS, type GameVariant } from "@/domain/games";
import { SESSION_STATUS } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Spielend verbinden" };

export default async function Spiele() {
  const { profileId, v } = await actingProfile();
  const [rules, features] = await Promise.all([
    db.gameRuleVersion.findFirst({ where: { active: true }, orderBy: { version: "desc" } }), getSetting("features"),
  ]);
  const games = v.can("games");
  const isCouple = v.profileRow.type === "couple";
  const sessions = await db.gameSession.findMany({
    where: { participants: { some: { profileId } } }, orderBy: { createdAt: "desc" }, take: 50,
    include: { participants: { include: { profile: { select: { handle: true } } } }, match: { select: { isMatch: true } } },
  });
  const pct = rules ? Math.round(rules.thresholdBp / 100) : 80;
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Spielend verbinden</h1>
      <section className="card stack" aria-labelledby="how-h">
        <h2 id="how-h">So funktioniert&apos;s</h2>
        <p className="muted" style={{ margin: 0 }}>Kennenlernspiele für Paare: Zwei Paare beantworten dieselben Fragen – jedes Paar gemeinsam. Danach seht ihr, wo ihr übereinstimmt. Für alle Tarife kostenlos.</p>
        <ul className="checks">
          <li>Eine Runde hat {rules?.roundSize ?? 10} Fragen. Ausgewertet wird, wenn mindestens {rules?.minAnswered ?? 8} Fragen von beiden Paaren beantwortet wurden.</li>
          <li>Ab {pct} % gleichen Antworten habt ihr einen Fragen-Match. „Überspringen“ und „Nicht mein Thema“ zählen nie als Treffer.</li>
          <li>Ein Match ist nur ein Vorschlag. Kontakt entsteht erst, wenn alle vier Personen zustimmen.</li>
          <li>Ihr seht nie die einzelnen Antworten des anderen Paars – nur Ergebnis und Gemeinsamkeiten.</li>
          <li>Danach gelten für Nachrichten die normalen Regeln eures Tarifs.</li>
        </ul>
        <div className="grid grid-3">
          {(Object.entries(GAME_VARIANTS) as [GameVariant, { title: string; description: string }][]).map(([k, g]) => (
            <div key={k} className="card tight"><h3 style={{ margin: 0 }}>{g.title}</h3><p className="muted" style={{ margin: 0 }}>{g.description}</p></div>
          ))}
        </div>
      </section>

      {!features.gamesEnabled ? (
        <p className="alert info">Spiele sind derzeit pausiert.</p>
      ) : !isCouple ? (
        <Gate reason="Kennenlernspiele sind für Paarprofile gedacht." cta={{ href: "/app/entdecken", label: "Profile entdecken" }} />
      ) : !games.allowed ? (
        <Gate reason={`${games.reason} Bei Paaren müssen beide Personen verifiziert sein.`} cta={{ href: "/app/verifizierung", label: "Jetzt verifizieren" }} />
      ) : (
        <section className="card" aria-labelledby="inv-h">
          <h2 id="inv-h">Paar einladen</h2>
          <ActionForm action={inviteGameAction} submit="Einladung senden">
            <div className="field">
              <label htmlFor="handle">Pseudonym des Paarprofils</label>
              <input id="handle" name="handle" type="text" required aria-describedby="handle-hint" />
              <p className="hint" id="handle-hint">Das andere Paar muss vollständig verifiziert sein. Einladungen pro Tag sind begrenzt ({rules?.inviteLimitPerDay ?? 5}).</p>
            </div>
            <fieldset>
              <legend>Variante</legend>
              {(Object.entries(GAME_VARIANTS) as [GameVariant, { title: string }][]).map(([k, g], i) => (
                <label key={k} className="check"><input type="radio" name="variant" value={k} defaultChecked={i === 0} /> {g.title}</label>
              ))}
            </fieldset>
          </ActionForm>
        </section>
      )}

      <section className="stack" aria-labelledby="ses-h">
        <h2 id="ses-h">Eure Runden</h2>
        {sessions.length === 0 ? <Empty title="Noch keine Runden">Lade ein Paar ein – oder warte auf eine Einladung.</Empty> : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sessions.map((s) => {
              const other = s.participants.find((p) => p.profileId !== profileId);
              const me = s.participants.find((p) => p.profileId === profileId);
              return (
                <li key={s.id}>
                  <Link className="card card-link tight row between" href={`/app/spiele/${s.id}`}>
                    <span>
                      <strong>{GAME_VARIANTS[s.variant as GameVariant]?.title ?? s.variant}</strong> mit {other?.profile.handle ?? "–"}
                      <span className="dim" style={{ display: "block" }}>{formatDate(s.createdAt)} · {s.invitedById === profileId ? "von euch eingeladen" : "Einladung an euch"}</span>
                    </span>
                    <span className="row">
                      <span className="badge neutral">{SESSION_STATUS[s.status] ?? s.status}</span>
                      {me?.status === "submitted" && s.status === "answering" && <span className="badge neutral">Ihr habt abgegeben</span>}
                      {s.match?.isMatch && <span className="badge verified">Fragen-Match</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
