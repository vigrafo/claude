# AGENTS.md – Arbeitsregeln für eropub.com

## Produkt
Verifizierte, diskrete Community nur für Erwachsene (18+). Software, KEINE expliziten Inhalte: UI-Texte, Beispieldaten und Bilder bleiben nicht explizit. Keine erfundenen Nutzerzahlen, Mitglieder, Beiträge, Kooperationen oder Zertifikate. Demo-Daten nur in Entwicklung und gekennzeichnet. Alle UI-Texte Deutsch, kurz, freundlich, Du-Form.

## Stack
Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript strict, Prisma 6 + PostgreSQL 16, Vitest. Keine weiteren UI-Frameworks; Styling ausschließlich über `src/app/globals.css` (Klassen: container, card, card-link, btn [secondary|ghost|danger|small], grid grid-2/3/4, row, between, stack, field, hint, alert [error|ok|info|warn], badge [verified|unverified|plan|neutral|demo], chips/chip, table-wrap, kpi, muted, dim, msg/mine, emoji-grid, admin-shell/admin-side/admin-main).

## Schichten
- `src/domain/*` – reine Fachregeln (Tarife, Zugriff `can()`, Spiele, Rabatte, Länder, Geo). Frontend und Backend nutzen dieselben Definitionen.
- `src/server/*` – Services mit Prisma; JEDE Mutation prüft Rechte serverseitig (Default deny). Fehler als `AppError` (`src/server/errors.ts`). Audit via `audit()`; keine sensiblen Inhalte in Audit-Meta.
- `src/app/actions/*` – Server Actions (`"use server"`), Signatur `(prev: ActionState, fd: FormData) => Promise<ActionState>`, Body in `run(async () => …)` aus `src/lib/actions.ts`; Hilfen `str/int/bool`.
- `src/components/ActionForm.tsx` – Client-Formular mit zugänglicher Fehleranzeige. `src/components/ui.tsx` – Logo, VerifiedBadge, Avatar, Empty, Gate, Icon, formatDate.
- Viewer: `requireViewer()`, `requireProfile()` (Mitglieder), `requireAdmin(permission)` (Admin; eigenes Cookie, MFA-Pflicht) aus `src/lib/viewer.ts`. `v.can("community" | "games" | "calls" | …)` liefert `{allowed, reason}`.

## Regeln
- Geld in Cent (Int) + Währung. Tokens nur über `postLedger()` (idempotent, Zeilensperre).
- Private Inhalte nie über erratbare IDs ohne Mitgliedschafts-/Rechteprüfung ausliefern.
- Nicht verifizierte Profile: nur entdecken, Kontaktanfragen, Nachrichten lesen, mit Tokens schreiben.
- Kontaktfilter und Blockierung haben Vorrang vor Tarif/Kauf.
- Admins sehen keine privaten Nachrichten/Spielantworten/Ausweisbelege ohne eigenes Recht, Zweck und Audit.
- Keine Testadapter in Produktion (`APP_ENV=production`).
- Suchmaschinen gesperrt, solange `ALLOW_SEARCH_INDEXING` nicht `true` ist.
- Barrierefreiheit: beschriftete Felder, sichtbarer Fokus, Touch-Ziele ≥ 44px, `aria-live` für Statusmeldungen.

## Prüfen
`npx tsc --noEmit`, `npx vitest run`, `npx next build`. Lokale DB: siehe README.
