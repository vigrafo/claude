export const MESSAGE_MAX = 2000;
export const GIFT_NOTE_MAX = 500;

export interface ValidationError {
  field: string;
  message: string;
}

/** Keine stille Textkürzung: zu lange Texte werden abgewiesen, nicht abgeschnitten. */
export function validateMessageBody(body: string, kind: "text" | "gift" | "media"): ValidationError | null {
  const max = kind === "gift" ? GIFT_NOTE_MAX : MESSAGE_MAX;
  const len = [...body].length;
  if (kind === "text" && body.trim().length === 0) return { field: "body", message: "Bitte gib eine Nachricht ein." };
  if (len > max) return { field: "body", message: `Höchstens ${max} Zeichen erlaubt (aktuell ${len}).` };
  return null;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Smartphone-taugliche Emoji-Auswahl (keine Bilder, systemeigene Emoji-Schrift). */
export const EMOJI_PICKER = [
  "😊", "😄", "😉", "😍", "🥰", "😘", "🤗", "😇", "🙂", "😅", "😂", "🤭", "😏", "🥂", "🍷", "☕",
  "🌹", "💐", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💞", "✨", "🔥", "🎉", "👍",
  "👋", "🙏", "💃", "🕺", "🎶", "🌙", "☀️", "🌊",
];

export const DEFAULT_TOKEN_PACKAGES = [
  { key: "t20", tokens: 20, priceCents: 500 },
  { key: "t40", tokens: 40, priceCents: 1000 },
  { key: "t100", tokens: 100, priceCents: 2500 },
] as const;
