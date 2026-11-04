# Anforderungen & Umsetzungsstand

Status: ✅ umgesetzt und getestet · 🟡 teilweise / mit Einschränkung · ⬜ offen (externe Voraussetzung oder Folgeetappe).
Testbelege: `tests/` (90 automatisierte Tests, Stand 04.11.2026) und Browser-Durchlauf `docs/test-results.md`.

| # | Anforderung | Status | Abnahmekriterium / Beleg |
|---|---|---|---|
| 1 | Marke, Logo (neu gestaltet: zwei Bögen, Oberkante rechts = Mittellinie links, zwei Herzen), Schwarz/Rot/Weiß, dezentes Silhouetten-Motiv | ✅ | `assets/*.svg`, `globals.css`, Screenshots |
| 2 | Responsive, mobile Hauptnavigation Entdecken/Nachrichten/Community/Events/Profil | ✅ | Screenshot `21-entdecken-mobil.png` |
| 3 | WCAG 2.2 AA (Fokus, Labels, Touch ≥ 44 px, reduzierte Bewegung, aria-live) | 🟡 | umgesetzt im Designsystem; formaler Audit mit Screenreader steht aus |
| 4 | Keine öffentlichen Profile, Suchmaschinen gesperrt | ✅ | Header `X-Robots-Tag`, `robots.txt Disallow: /`, Meta-Robots (live geprüft) |
| 5 | User / CommunityProfile / ProfileMembership; Paar = 2 eigene Logins, Badge erst wenn beide verifiziert | ✅ | `tests/unit/domain.test.ts` „Paar mit nur einer geprüften Person bleibt gesperrt“ |
| 6 | Paar-Trennung, Umwandlung in Einzelprofil, Rechte-Neubewertung | ✅ | `profiles.leaveCouple`, `/app/profil/paar` |
| 7 | Nicht verifiziert: entdecken, Kontakte, lesen, mit Tokens schreiben; sonst gesperrt | ✅ | `can()`-Tests, `community.test.ts` |
| 8 | Verifizierungs-Statusmodell, Warteschlange, Einspruch, Anleitung (Dokument neben Gesicht, Pass-Datenseite) | ✅ | `/app/verifizierung`, `/admin/verifizierung` |
| 9 | Echter Identitäts-/Altersverifikationsanbieter (KJM-konform) | ⬜ | nur Testadapter; Anbieterwahl + Vertrag offen (`docs/verification.md`) |
| 10 | Tarife Basis/Premium/Gold, 24-Monats-Regel je Person, Hinweis 30 Tage vorher | ✅ | Unit-Tests Monat 24/25, Zeitzonen, Kündigung/Neustart, Gold-Wechsel; `jobs.test.ts` |
| 11 | Preiswechsel nach 24 Monaten beim echten Zahlungsanbieter | ⬜ | anbieterabhängig (`docs/payments.md`) |
| 12 | Tokens: Ledger, Idempotenz, Parallelität, kein Abzug bei Abweisung, Chargeback ohne Negativsaldo | ✅ | `messaging.test.ts`, `payments.test.ts` |
| 13 | Eine Nachrichtenanfrage an Fremde, weitere erst nach Annahme | ✅ | `messaging.test.ts` |
| 14 | Emoji-Auswahl, Geschenke mit serverseitigen Kosten, 500/2000 Zeichen ohne stille Kürzung | ✅ | `MessageComposer`, Tests |
| 15 | Entdecken mit Erklärungen statt Prozentwerten, Filter, grobe Entfernung | 🟡 | `member-discover.test.ts`; PLZ→Koordinaten-Geodaten fehlen noch (`docs/regions.md`) |
| 16 | Kontaktanfragen mit Limit, Favoriten, Like/Pass ohne Kontaktfreigabe, Blockieren, Melden | ✅ | `member-contacts.test.ts`, `member-reports-dates.test.ts` |
| 17 | Kennenlernspiele (3 Varianten, 36 Fragen, Snapshots, Bestätigung beider Personen, 8/10, 7/8, unvollständig, 4 Zustimmungen) | ✅ | `games.test.ts` |
| 18 | Audio-/Videoanrufe (LiveKit) | 🟡 | Rechte, Raumtokens, Entzug, Limits serverseitig; Browser-Client (`livekit-client`) und LiveKit-Server-Betrieb offen |
| 19 | Gruppen/Foren mit Freigabe, 16 offizielle Themen, Moderator-Bewerbung, Schreibfreigabe | ✅ | `community.test.ts`, Seed |
| 20 | Events, Clubs (Sterne nur eropub), Kapazität, 30-Min-Vormerkung, Anbieterlink + manueller Abgleich | ✅ | `events.ts`, Admin `/admin/events` |
| 21 | Gold-Rabatt 10 € einmal je Event/Profil, Parallelität, Storno/Erstattung | ✅ | `community.test.ts` |
| 22 | Gold-CMS mit Paywall auf Server-Ebene, Versionen, Planung | ✅ | Admin `/admin/gold`, `/app/gold` |
| 23 | Dates mit PLZ-/Umkreissuche | 🟡 | PLZ-Präfix-Annäherung; echte Umkreissuche benötigt Geodaten |
| 24 | Zahlungs-Adapterkatalog mit wahrheitsgemäßem Status, Webhook-Sicherheit | ✅ | `payments.test.ts`, `/admin/zahlungsanbieter` |
| 25 | Echter Zahlungsanbieter live | ⬜ | CCBill-Adapter im Sandbox-Stand ungetestet gegen echte Sandbox; Merchant-Vertrag offen |
| 26 | Vollständiges Admin-Backend (24 Bereiche), MFA, Re-Auth, Vier-Augen, Audit | ✅ | `docs/admin-coverage.md`, `admin-*.test.ts`, Browser-Check aller Bereiche (HTTP 200) |
| 27 | Rollenmatrix, Default deny, keine Impersonation, kein Mailbox-Zugriff | ✅ | `docs/permissions.md`, `admin-rbac.test.ts` |
| 28 | Kontaktadressen verwaltung@ / contakt@ / info@ (Schreibweise beibehalten), konfigurierbar | ✅ | `settings.ts` |
| 29 | Neutrale Benachrichtigungen/E-Mails ohne Inhalte | ✅ | `jobs.test.ts`, `mail.ts` |
| 30 | Datenexport, Kontolöschung, Tombstones nach Restore | ✅ | `jobs.test.ts` |
| 31 | Länder Europas inkl. Kleinstaaten/Gebiete, RU/BY ausgeschlossen, Regionskatalog + Freitext | ✅ | Unit-Test; Datenlücken in `docs/regions.md` |
| 32 | Ubuntu-Betrieb: Docker/Compose, Caddy, Firewall-Hinweise, Backup/Restore, Monitoring, Kostenmodell | 🟡 | Dateien validiert (`compose config`), **Container nie gestartet** (kein Docker-Daemon in der Entwicklungsumgebung) |
| 33 | Deployment auf eropub.de (Strato/Plesk) | ⬜ | erfordert Serverzugang; Anleitung `docs/ubuntu-deployment.md` |
| 34 | Medien-Upload mit EXIF-Entfernung, S3-Speicher | ⬜ | Auslieferung mit Rechteprüfung vorhanden; Upload-Pipeline (S3, EXIF-Strip, Bildprüfung) Folgeetappe |
| 35 | Rechtstexte (Impressum, Datenschutz, AGB), DSFA | ⬜ | Entwürfe als Platzhalter, rechtliche Prüfung erforderlich |
