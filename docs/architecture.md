# Architektur

## Überblick

```
Browser ──HTTPS──> Caddy ──> Next.js (web, Port 3000) ──> PostgreSQL 16
                     │              │  Server Components / Server Actions / Route Handler
                     │              └─> Outbox-Tabelle ──> Worker (separater Prozess) ──> SMTP, LiveKit-API
                     └──> LiveKit (rtc.eropub.com, WebRTC/TURN)       Redis/Valkey (optional: Ratelimits/Cache)
                                                                       S3-kompatibler privater Speicher (MinIO)
```

**Modularer Monolith** statt Microservices: Eine Next.js-Anwendung mit klar getrennten Domänen, ein Worker-Prozess für asynchrone Arbeit.

| Schicht | Ort | Aufgabe |
|---|---|---|
| Fachregeln | `src/domain/` | reine Funktionen ohne I/O: Tarife & 24-Monats-Regel (`plans.ts`), Zugriffsmatrix `can()` (`access.ts`), Spielauswertung (`games.ts`), Gold-Rabatt (`discount.ts`), Nachrichtenlängen/Emoji/Tokenpakete (`messaging.ts`), Länder (`countries.ts`), Geo (`geo.ts`). Von Server **und** UI genutzt. |
| Services | `src/server/` | Prisma-Transaktionen, Rechteprüfung (Default deny), Audit, Outbox. |
| Adapter | `src/server/payments/`, `src/server/verification.ts`, `src/server/mail.ts`, `src/server/calls.ts` | austauschbare Anbieter mit ehrlichem Implementierungsstatus; Testadapter in Produktion technisch gesperrt. |
| Web | `src/app/` | `(public)` öffentliche Seiten, `app/` Mitgliederbereich, `admin/` Administration, `api/` Webhooks & Health. |
| Worker | `worker/index.ts`, `src/server/jobs.ts` | Outbox-Zustellung, Löschläufe, Abläufe, Preis-Hinweise. |

## Wichtige Entscheidungen (ADR-Kurzform)

1. **Next.js 15.5 (LTS-Zweig) statt 16.x**: 15.5 erhält weiterhin Sicherheitsupdates und ist breit erprobt; Upgrade auf 16 nach Stabilisierung geplant. **Prisma 6.19** statt 7: Prisma 7 erzwingt neue Treiberadapter-/Config-Struktur; 6.x ist stabil und unterstützt. TypeScript 5.9.
2. **Eigene Sessionverwaltung** (DB-Sessions, `httpOnly`-Cookies, argon2id, TOTP via `otplib`) statt Auth-Bibliothek: volle Kontrolle über getrennte Admin-Sessions (MFA-Pflicht, 8 h, Re-Auth) und Sitzungswiderruf bei Rechteentzug.
3. **Transaktionale Outbox in PostgreSQL** (statt Queue-first): Nachricht, Tokenbuchung und Zustellereignis werden atomar geschrieben; der Worker liest mit `FOR UPDATE SKIP LOCKED`. Redis/Valkey bleibt optional für Ratelimits/Cache; Ratelimits funktionieren zunächst DB-basiert.
4. **Token-Ledger**: unveränderliche Buchungen mit eindeutigem `idemKey`, Kontostand-Cache wird unter Zeilensperre (`SELECT … FOR UPDATE`) in derselben Transaktion fortgeschrieben. Nachrichten haben einen eindeutigen Client-Idempotenzschlüssel je Profil; Konversationen werden per `INSERT … ON CONFLICT DO NOTHING` + Zeilensperre serialisiert.
5. **Spielrunden als Snapshot**: Regeln und Fragen werden beim Start als JSON in `GameSession` eingefroren; Auswertung ist idempotent (`GameMatch.sessionId` eindeutig).
6. **Gold-Rabatt-Reservierung**: `DiscountRedemption.activeKey` (`regel:event:profil`) ist eindeutig, solange reserviert/eingelöst → parallele Checkouts erhalten den Rabatt höchstens einmal; Freigabe setzt `activeKey = null`.
7. **Audit-Hashkette** mit Advisory-Lock und kanonischer JSON-Serialisierung.
8. **Löschung & Backups**: `DeletionTombstone` + `worker --reapply-deletions` nach jedem Restore.
9. **Suchmaschinen gesperrt** standardmäßig (`robots.txt` Disallow, `X-Robots-Tag`, `<meta robots>`), Freigabe nur über `ALLOW_SEARCH_INDEXING=true`.

## Sicherheit (Kurzfassung)
- CSP, `X-Frame-Options: DENY`, `nosniff`, Permissions-Policy (Kamera/Mikrofon nur self).
- Server Actions prüfen Mitgliedschaft des handelnden Kontos im handelnden Profil (IDOR-Schutz); Next.js prüft Origin für Server Actions (CSRF).
- Ratelimits für Registrierung, Login, Passwort-Reset, Kontaktformular, Kontaktanfragen.
- Keine Secrets im Klartext in der DB-Oberfläche (AES-256-GCM, Anzeige maskiert).
- Webhooks: Signatur/Herkunft, Replay-Schutz (Zeitstempel + eindeutige Event-ID), Abgleich von Order, Betrag, Währung, Merchant.
