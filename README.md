# eropub.com

**Echte Menschen. Echte Verbindungen.** – verifizierte, diskrete Community ausschließlich für Erwachsene (18+): Dating, offene Beziehungen, Swinger-Community, Gruppen, Foren, Events, Clubs und Kennenlernspiele für Paare. Die Software selbst enthält keine expliziten Inhalte.

> Status: Entwicklungsstand. Zahlungen, Identitätsprüfung und E-Mail laufen lokal über klar gekennzeichnete **Simulationen**; echte Anbieter sind vorbereitet, aber **nicht** produktiv angebunden (siehe „Offene Voraussetzungen“). Suchmaschinen sind standardmäßig gesperrt.

## Schnellstart (lokal)

Voraussetzungen: Node.js 22, PostgreSQL 16 (oder `docker compose up -d` für Postgres/Valkey/MinIO/Mailpit).

```bash
npm ci
```

```bash
cp .env.example .env
```

In `.env` mindestens `DATABASE_URL`, `SESSION_SECRET` und `DATA_ENCRYPTION_KEY` setzen (Schlüssel erzeugen: `openssl rand -base64 32`). Für lokale Tests `APP_ENV=development` und `ENABLE_TEST_ADAPTERS=true`.

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run admin:bootstrap
```

```bash
npm run dev
```

In einem zweiten Terminal den Worker starten:

```bash
npm run worker
```

- Mitgliederbereich: http://localhost:3000 → Registrieren → im Entwicklungsmodus erscheint der Bestätigungslink direkt auf der Seite (keine echten E-Mails).
- Verifizierung: `/app/verifizierung` → Testsimulation (nur außerhalb Produktion).
- Zahlungen: Checkout führt zur Testsimulation `/checkout/test` (nur außerhalb Produktion).
- Administration: http://localhost:3000/admin (MFA verpflichtend).

## Tests

```bash
npx vitest run
```

Unit-Tests (Fachregeln) und Integrationstests gegen PostgreSQL (`TEST_DATABASE_URL`, Standard `postgresql://eropub:eropub_dev@localhost:5432/eropub_ci` – die Testdatenbank wird dabei geleert). Typprüfung: `npx tsc --noEmit`. Build: `npx next build`.

## Dokumentation

| Thema | Datei |
|---|---|
| Architektur & Entscheidungen | `docs/architecture.md` |
| Anforderungen & Umsetzungsstand | `docs/requirements.md` |
| Datenmodell | `docs/data-model.md` |
| Rollen & Rechte | `docs/permissions.md` |
| Admin-Abdeckung | `docs/admin-coverage.md` |
| Tarife, Tokens, Rabatte | `docs/tariffs.md` |
| Zahlungen | `docs/payments.md` |
| Verifizierung | `docs/verification.md` |
| Anrufe & Fotos | `docs/calls-and-media.md` |
| Datenschutz | `docs/privacy.md` |
| Moderation | `docs/moderation.md` |
| Länder/Regionen | `docs/regions.md` |
| Ubuntu-Betrieb (inkl. Plesk/Strato) | `docs/ubuntu-deployment.md` |
| Backup & Restore | `docs/backup-restore.md` |
| Monitoring | `docs/monitoring.md` |
| Kostenmodell | `docs/cost-model.md` |
| Mail-DNS | `docs/mail-dns.md` |

## Suchmaschinen
Gesperrt, solange `ALLOW_SEARCH_INDEXING` nicht `true` ist: `robots.txt` (`Disallow: /`), Header `X-Robots-Tag: noindex, nofollow, noarchive`, `<meta name="robots" content="noindex,nofollow">`. Auch nach Freigabe sind Mitgliederbereiche nie indexierbar (Login erforderlich).

## Logo
`assets/eropub-logo.svg`, `assets/eropub-logo-invers.svg`, `assets/eropub-icon.svg` – neu gestaltet: zwei offene, gegensinnige Bögen (Oberkante des rechten Bogens exakt auf der Mittellinie des linken), zwei integrierte Herzen, Wortmarke `eropub.com`. Die Wortmarke nutzt die selbst gehostete Schrift Fraunces; für Druck/Fremdverwendung sollte sie in Pfade umgewandelt werden.
