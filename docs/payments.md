# Zahlungen

## Begriffe
- **Anbieter** (Adapter): CCBill, Segpay, Stripe, PayPal, Mollie, Adyen, lokaler Testadapter.
- **Methode**: Karte, SEPA-Lastschrift, Überweisung, Wallets – nur soweit vertraglich vom Anbieter unterstützt.

## Status je Anbieter (wahrheitsgemäß, Stand dieser Version)
| Anbieter | Implementierung | Eignung | Hinweis |
|---|---|---|---|
| Testadapter | `sandbox_only` | nur Entwicklung | HMAC-signierte Webhooks; in `APP_ENV=production` technisch gesperrt |
| CCBill | `sandbox_only` (Adapter-Stand) | `approval_required` | FlexForms-Checkout + Webhook-Parser nach öffentlicher Doku; Webhooks unsigniert → IP-Allowlist (`CCBILL_WEBHOOK_IPS`) + Abgleich; **nicht gegen echte Sandbox getestet**, Merchant-Vertrag offen |
| Segpay | `not_implemented` | `approval_required` | nächster Kandidat |
| Stripe | `not_implemented` | `not_eligible` | Richtlinie zu eingeschränkten Geschäftsmodellen |
| PayPal | `not_implemented` | `not_eligible` | Richtlinie zu sexuell orientierten Waren/Dienstleistungen |
| Mollie, Adyen | `not_implemented` | `approval_required` | Eignung vertraglich klären |

Aktivierung im Backend nur, wenn `canEnable()` erfüllt ist: implementiert (oder Sandbox außerhalb Produktion), konfiguriert, nicht `not_eligible`; Livebetrieb nur `implemented` + `eligible`.

## Ablauf
1. Mitglied wählt Paket/Tarif → `Order` (Cent + Währung, `idemKey`) → Hosted Checkout des Anbieters (keine Kartendaten bei eropub).
2. Browser-Rückleitung zeigt nur den Status – **keine** Freischaltung.
3. Webhook `/api/webhooks/payments/:provider` → Signatur/Herkunft → `WebhookEvent` (eindeutig `provider+eventId`, Replay-Schutz) → Order-Zeilensperre → Prüfung Anbieter, Merchant-ID, Betrag, Währung → idempotente Erfüllung (Ledger-`idemKey purchase:<order>`, Entitlement, Ticket) → Rechnung.
4. Verspätete/vertauschte Ereignisse: Zahlung nach Erstattung/Chargeback wird abgewiesen; doppelte Transaktions-IDs werden ignoriert.

## Offene Punkte vor Livebetrieb
- Merchant-Onboarding (wahrheitsgemäße Angabe der Portalausrichtung, keine falsche Kategorie).
- CCBill: aktuelle IP-Bereiche, Ereignisnamen, `formDigest`, Währungscode, Abrechnungstext (diskret, regelkonform) mit Vertrag/Doku abgleichen; Ende-zu-Ende-Test in CCBill-Sandbox.
- **24-Monats-Preiswechsel**: mit dem Anbieter klären, ob ein laufendes Abo per API umgepreist werden kann. Fallback: Abo mit Einführungspreis endet planmäßig; Mitglied bestätigt aktiv ein Folgeabo zu 14 € (mit Hinweis 30 Tage vorher). Bis dahin ist der Wechsel nur lokal berechnet und **nicht** produktiv freigegeben.
- SEPA-Mandate/Rücklastschriften, Banküberweisung mit Referenz und Vier-Augen-Freigabe.
- Steuer-/Rechnungsangaben (USt-Sätze je Land, OSS) fachlich prüfen.
