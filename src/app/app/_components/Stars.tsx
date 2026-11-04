/** eropub-Sterne (1–5), ausschließlich von eropub vergeben. */
export function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="dim">Noch nicht von eropub bewertet</span>;
  return <span aria-label={`${n} von 5 Sternen, nur von eropub vergeben`} title="Sterne werden nur von eropub vergeben">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}
