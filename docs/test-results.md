# Testergebnisse (04.11.2026)

## Automatisiert
`npx vitest run` → **12 Testdateien, 90 Tests bestanden** (Unit: Fachregeln; Integration gegen PostgreSQL 16: Nachrichten/Tokens inkl. Parallelität, Zahlungen/Webhooks, Abos, Spiele, Gruppen/Events/Rabatt, Worker-Jobs, Mitgliederbereich, Admin-Rollen/Vier-Augen/MFA).
`npx tsc --noEmit` → keine Fehler. `npx next build` → erfolgreich.

## Browser-Durchlauf (Playwright, Produktionsbuild `next start`)
1. Registrierung zweier Einzelprofile → E-Mail-Bestätigung (Dev-Link) → Verifizierung über Testsimulation → Badge „Verifiziert“ ✓
2. Token-Kauf (20 Tokens) über Test-Checkout → Gutschrift ausschließlich per signiertem Webhook ✓
3. Erste Nachricht = Nachrichtenanfrage (1 Token), weitere gesperrt bis Annahme; Empfänger sieht Anfrage ✓
4. Mobilansicht (iPhone 13) mit unterer Hauptnavigation ✓
5. Admin-Login mit TOTP → Dashboard mit echten Kennzahlen, Audit-Kette „intakt“ ✓
6. 12 weitere Mitgliederseiten und 25 Admin-Bereiche: HTTP 200, keine Serverfehler, keine JS-Fehler ✓
7. Header `X-Robots-Tag: noindex, nofollow, noarchive` und `robots.txt Disallow: /` ✓

Screenshots: `docs/screenshots/`.

## Nicht getestet
Docker-Images/Container, Caddy, LiveKit-Anrufe zwischen zwei Browsern, echte Zahlungs-/Identitätsanbieter, E-Mail-Versand über SMTP, Backup/Restore-Skripte, Screenreader-Audit.
