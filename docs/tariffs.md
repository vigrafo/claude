# Tarif-, Token- und Rabattregeln

Implementierung: `src/domain/plans.ts`, `src/domain/access.ts`, `src/server/subscriptions.ts`, `src/server/tokens.ts`, `src/domain/discount.ts`, `src/server/events.ts`. Tests: `tests/unit/domain.test.ts`, `tests/integration/payments.test.ts`, `tests/integration/messaging.test.ts`, `tests/integration/community.test.ts`.

## Tarife
| | Basis | Premium | Gold |
|---|---|---|---|
| Preis/Monat (Endpreis) | 0 € | 7 € für 24 Monate ab erster Premium/Gold-Aktivierung, danach 14 € | 25 € |
| Voraussetzung | E-Mail bestätigt, Volljährigkeit erklärt | vollständige Identitätsprüfung | vollständige Identitätsprüfung |

Premium/Gold-Rechte greifen **nur mit gültiger Identitätsprüfung** (`effectivePlan()`); ohne Prüfung gilt Basis (Token-Chat). Zahlung, Admin-Korrektur oder Testflag überspringen das nicht (`activatePlanFromOrder` prüft erneut, Admin-Entitlement für Unverifizierte wird blockiert).

## 24-Monats-Regel (verbindlich, je Person)
- `PremiumClock.firstPremiumActivatedAt` + `introPriceEndsAt` werden bei der **ersten** Premium- **oder** Gold-Aktivierung einmalig gesetzt (Vorschlag aus dem Auftrag: Gold startet die Frist ebenfalls, damit Wechsel keine neue Frist erzeugen).
- Kündigung/Neubuchung setzt die Frist nicht zurück; Pausen verlängern sie nicht.
- Preis je Abrechnungszeitraum: `periodStart >= introPriceEndsAt` → 14 €, sonst 7 €. Keine taggenaue Nachforderung innerhalb eines laufenden Monats.
- Kalendermonate in UTC mit Monatsende-Klemmung (31.01. + 1 Monat = 28./29.02.).
- Hinweis 30 Tage vor dem ersten höheren Betrag (Worker `sendPriceNotices`), Datum in Konto/Checkout (`priceOutlook`).
- Adminänderungen erzeugen neue `PlanVersion` mit künftigem `validFrom`; bestehende Abos behalten ihre Version.
- **Offen (anbieterabhängig):** Der Preiswechsel muss beim Zahlungsanbieter tatsächlich unterstützt und getestet sein (siehe `payments.md`). Ein Abo wird nie nur lokal „teurer markiert“.

## Wechsel & Sonderfälle
| Fall | Regel |
|---|---|
| Upgrade Premium → Gold | sofort; altes Abo endet ohne Doppelbelastung (anteilige Verrechnung durch Anbieter, sofern unterstützt) |
| Downgrade Gold → Premium/Basis | zum Periodenende |
| Kündigung | zum Periodenende (`cancel_at_period_end`), Rechte bis Periodenende |
| Fehlzahlung | Abo `past_due`; Rechte enden mit Entitlement-Ablauf (Periodenende + 3 Tage Kulanz) |
| Rückbuchung/Erstattung | Abo sofort beendet, Entitlement widerrufen |
| Anbieterwechsel | bestehende Abos bleiben beim ursprünglichen Anbieter; keine stille Migration |
| Paarprofil | jede Person eigene Mitgliedschaft und eigene 24-Monats-Frist; keine automatische Freischaltung der Partnerperson; Tokens gehören dem Profil |

## Tokens
- Pakete (versioniert): 20 = 5 €, 40 = 10 €, 100 = 25 € (kein Mengenbonus).
- 1 Token je gesendeter Text-/Medien-/Geschenknachricht (Basis). Verifizierte Premium/Gold: 0 Tokens für Nachrichten; Geschenke kosten ihren konfigurierten Tokenpreis.
- Lesen, Melden, Support, Gruppen/Foren, Spiele: kostenlos.
- Erste Nachricht an Fremde = genau eine Nachrichtenanfrage (zählt als gesendete Nachricht); weitere erst nach Annahme bzw. Antwort.
- Abgewiesene Nachrichten (Rechte, Filter, Block, Länge, Guthaben) kosten nichts (Prüfung vor Buchung, Rollback).
- Technischer Fehlschlag nach Speicherung → `refundTechnicalFailure` (nachvollziehbare Rückbuchung).
- Gutschrift nur durch bestätigte Zahlung (Webhook) oder begründete Admin-Korrektur (> 100 Tokens: Vier-Augen-Prinzip).
- Kein automatischer Verfall, kein automatischer Nachkauf.
- Chargeback: Rückbuchung bis zum verfügbaren Guthaben, Rest als `TokenDebt`; Käufe gesperrt bis zur Klärung.
- Erstattung/Widerruf/Kontolöschung: Prozess rechtlich zu prüfen (verbraucht vs. unverbraucht getrennt).

## Gold-Partyrabatt
- 10 € auf **ein** bezahltes, rabattfähiges Ticket je Event und Gold-Profil (Paarprofil: ein Paar- oder Einzelticket).
- Höchstens bis zum Ticketpreis; Gebühren nicht rabattfähig; nicht mit anderen Gutscheinen kombinierbar (konfigurierbar).
- Nur für eropub-Events oder Events vertraglich bestätigter Partner (`Organizer.isPartner`), von der Administration freigegeben.
- Reservierung atomar beim Ticket-Reservieren (30 Minuten), Einlösung bei Zahlung, Freigabe bei Storno/Ablauf/Erstattung.
