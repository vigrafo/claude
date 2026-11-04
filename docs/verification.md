# Identitäts- und Altersverifikation

## Statusmodell
`not_started → in_progress → (pending_review) → verified | rejected`; später `expired` / `revoked`. Einspruch: `rejected → pending_review` (Priorität erhöht). Implementierung: `src/server/verification.ts`.

## Trennung
- **Alterszulassung** (18+) und **Identitätsbadge** sind getrennte Anforderungen. Die Registrierung erfasst nur eine Selbstauskunft (`adultConfirmedAt`) – sie ist **kein** Altersnachweis.
- Vor öffentlichem Betrieb muss ein verbindlicher Alterszugang umgesetzt sein (siehe unten).

## Anbieteradapter
- Schnittstelle `IdentityProvider` (Start → Weiterleitung zum Anbieter, Ergebnis per signiertem Callback `/api/webhooks/identity/:provider`).
- Gespeichert werden nur: pseudonyme Anbieterreferenz, Ergebnis, bestätigte Volljährigkeit, Zeitpunkt, Gültigkeit, Begründung. **Keine** Ausweisbilder, keine Gesichtsvorlagen.
- Temporäre Belege (falls ein Verfahren sie zwingend erfordert): nur als Speicherschlüssel in eigenem privaten Bucket, verschlüsselt, Löschfrist `evidencePurgeAt`, Zugriff nur mit Recht `verification.evidence` und Audit. Der Worker löscht abgelaufene Belege.
- **Status: Es ist nur ein Testadapter (Simulation) implementiert.** Er ist in Produktion gesperrt. Ein echter Anbieter ist offen.

## Anforderungen an den echten Anbieter (Auswahlkriterien)
- Dokumentprüfung, Identitätsabgleich, Lebenderkennung (soweit verfahrensbedingt erforderlich).
- Für Deutschland: KJM-Bewertung des **Gesamtverfahrens** inklusive Authentifizierung bei Folgezugriffen prüfen (siehe KJM-Übersicht positiv bewerteter AVS). Ein einzelnes Foto oder eine manuelle Bestätigung ist kein ausreichendes Gesamtsystem.
- Datenverarbeitung in der EU/EWR oder mit geeigneten Garantien; AV-Vertrag; Löschfristen.
- Paare: jede Person durchläuft das Verfahren einzeln.

## Benutzerführung (umgesetzt in `/app/verifizierung`)
1. Dokumenttyp und Ausstellungsland wählen.
2. Personalausweis: Vorder- **und** Rückseite, vollständig, scharf, ohne Spiegelung/abgeschnittene Ecken.
3. Fotoabgleich: Dokument **neben** das Gesicht halten (nicht davor). Gibt das Anbieter-SDK einen eigenen Live-Selfie-Ablauf vor, gilt dieser.
4. Reisepass: Lichtbild-/Datenseite, ganze Seite, Glanz vermeiden; keine „Rückseite“, keine Fotos aller Seiten; NFC/Zusatzseite nur auf Anbieteranforderung.
5. Paare: jede Person mit eigenem Dokument, die Partnerperson sieht keine Unterlagen.
6. Fortschritt, begründete Fehler, Wiederholung, Einspruch, Supportweg.

## Manuelle Prüfung
Prüfer:innen (`verification.review`) können nur ergänzend entscheiden; Freigabe nur, wenn der Anbieter die Volljährigkeit technisch bestätigt hat (`adultConfirmed = true`). Eigene Fälle sind ausgeschlossen. Entzug löst `onRightsRevoked` aus (Spiele, Anrufe).
