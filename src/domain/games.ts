/**
 * Kennenlernspiele „Spielend verbinden“ – reine Auswertung.
 * Startregeln (versioniert konfigurierbar): Runde mit 10 Fragen, mind. 8 von beiden Paaren
 * beantwortete Fragen, mind. 80 % Übereinstimmung (aufgerundet).
 */

export interface GameRules {
  roundSize: number;
  minAnswered: number;
  thresholdBp: number; // Basispunkte: 8000 = 80 %
}

export const DEFAULT_GAME_RULES: GameRules = { roundSize: 10, minAnswered: 8, thresholdBp: 8000 };

export type AnswerMap = Record<string, string | null>; // questionKey → optionKey | null (übersprungen)

export interface ScoreResult {
  status: "match" | "no_match" | "incomplete";
  answeredBoth: number;
  hits: number;
  requiredHits: number;
  sharedKeys: string[];
}

/** Benötigte Treffer = ceil(answered * threshold). 10 → 8, 8 → 7 (6,4 aufgerundet), 9 → 8. */
export function requiredHits(answeredBoth: number, thresholdBp: number): number {
  return Math.ceil((answeredBoth * thresholdBp) / 10_000);
}

export function scoreRound(
  a: AnswerMap,
  b: AnswerMap,
  rules: GameRules = DEFAULT_GAME_RULES,
  neutralOptionKeys: ReadonlySet<string> = new Set(["not_my_topic"]),
): ScoreResult {
  const keys = Object.keys(a).filter((k) => k in b);
  let answeredBoth = 0;
  let hits = 0;
  const sharedKeys: string[] = [];
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (x == null || y == null) continue; // Überspringen zählt nicht
    answeredBoth += 1;
    if (x === y && !neutralOptionKeys.has(x)) {
      hits += 1;
      sharedKeys.push(k);
    }
  }
  const need = requiredHits(answeredBoth, rules.thresholdBp);
  if (answeredBoth < rules.minAnswered) {
    return { status: "incomplete", answeredBoth, hits, requiredHits: need, sharedKeys };
  }
  return { status: hits >= need ? "match" : "no_match", answeredBoth, hits, requiredHits: need, sharedKeys };
}

export function resultText(r: ScoreResult): string {
  if (r.status === "incomplete") {
    return `Runde unvollständig: nur ${r.answeredBoth} Fragen wurden von beiden Paaren beantwortet.`;
  }
  const base = `${r.hits} von ${r.answeredBoth} Antworten passen zusammen`;
  return r.status === "match"
    ? `${base} – ihr habt einen Fragen-Match!`
    : `${base}. Unterschiede sind ganz normal – vielleicht passt die nächste Runde besser.`;
}

/** Stabile Prüfsumme über eine Antwortversion – Bestätigungen beziehen sich darauf. */
export function answersHash(answers: AnswerMap): string {
  const keys = Object.keys(answers).sort();
  const s = keys.map((k) => `${k}=${answers[k] ?? "_"}`).join("|");
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return `${keys.length}:${h1.toString(16)}`;
}

export type GameVariant = "either_or" | "our_evening" | "what_matters";
export const GAME_VARIANTS: Record<GameVariant, { title: string; description: string }> = {
  either_or: { title: "Entweder oder", description: "Kurze Auswahlfragen zu Kennenlernen, Freizeit und Kommunikation." },
  our_evening: { title: "Unser gemeinsamer Abend", description: "Kleine Planungsfragen zu Atmosphäre, Aktivität, Zeit und Gruppengröße." },
  what_matters: { title: "Was uns wichtig ist", description: "Fragen zu Privatsphäre, Umgangsformen, Planung und respektvoller Kommunikation." },
};
