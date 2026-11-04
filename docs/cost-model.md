# Kostenmodell (Planungsgrundlage)

> **Keine Rentabilitätszusage.** Alle Zahlen sind Annahmen bzw. grobe Schätzungen zur Planung,
> keine Angebote und keine Prognose. Anbieterpreise (Hosting, Verifizierung, Zahlungsabwicklung)
> stehen erst nach Vertragsverhandlungen fest. Steuerliche Punkte mit Steuerberatung klären.
> Mit „Annahme“ gekennzeichnete Werte sind ausdrücklich nicht recherchiert/vertraglich belegt.

Preise laut Code (`src/domain/plans.ts`, `prisma/seed.ts`), Endkundenpreise brutto inkl. USt:

| Produkt | Preis |
|---------|-------|
| Basis | 0 € |
| Premium (Einführungspreis, 24 Monate ab Erstaktivierung) | 7 €/Monat |
| Premium (regulär) | 14 €/Monat |
| Gold | 25 €/Monat |
| Token | 20 Token = 5 € (0,25 €/Token) |
| Gold-Partyrabatt | 10 € je eingelöstem Ticket, **von eropub finanziert** |

Rechengrundlage: 19 % USt (DE). Bei Verkäufen an Verbraucher in anderen EU-Staaten gilt der
jeweilige Satz (OSS) – Nettoerlös kann leicht abweichen.

## 1. Annahmen nach Größe

| Annahme | 1k Mitglieder | 10k Mitglieder | 50k Mitglieder |
|---------|---------------|----------------|----------------|
| Zahlende Mitglieder (Annahme 20–30 %) | 200–300 | 2.000–3.000 | 10.000–15.000 |
| Gleichzeitig online, Spitze (Annahme 5–10 %) | 50–100 | 500–1.000 | 2.500–5.000 |
| Gleichzeitige Anrufe, Spitze (Annahme) | 5–15 | 50–150 | 250–700 |
| Medien je Mitglied (Annahme ~10 Bilder inkl. Varianten ≈ 20 MB) | ~20 GB | ~200 GB | ~1 TB |
| Datenbank (Annahme, inkl. Nachrichten/Audit) | < 2 GB | 5–20 GB | 30–100 GB |
| Backup-Speicher off-site (≈ 1,5–2 × Daten bei 7/4/6-Aufbewahrung) | ~40 GB | ~400 GB | ~2 TB |
| Support/Moderation (Annahme 0,5–1,5 min je Mitglied/Monat) | 8–25 h/Monat | 80–250 h/Monat | 400–1.250 h/Monat (≈ 2,5–8 VZÄ) |

## 2. Server-Dimensionierung (Richtwerte, vor Lastspitzen messen)

| Größe | Aufbau | Annahme Kosten/Monat |
|-------|--------|----------------------|
| 1k | 1 Server: 4 vCPU, 8–16 GB RAM, 160–250 GB NVMe, 1 Gbit/s; alles in Compose | 20–60 € |
| 10k | 1 App/DB-Server 8 vCPU, 32 GB, 500 GB NVMe + **separater LiveKit-Knoten** (4–8 vCPU, 1 Gbit/s) | 80–200 € |
| 50k | App-Server (2×, hinter LB), dedizierte DB (16 vCPU, 64 GB, Replika), 2–4 LiveKit-Knoten, Objektspeicher 1–2 TB, Monitoring-Server | 400–1.000 € |

Dazu: Off-Site-Backup-Speicher (Annahme 3–5 €/TB/Monat), Mailversand (Annahme 0–30 €/Monat
je nach Volumen/Anbieter), Domains/DNS.

Der vorhandene Strato-Server (Plesk) ist für Staging und den Start (≈ 1k) denkbar, sofern RAM/CPU
nach Abzug von Plesk ausreichen und UDP-Ports freigegeben werden können.

## 3. LiveKit-Bandbreite

1:1-Anrufe über SFU (LiveKit): jede Person sendet einmal zum Server, der Server leitet an die
Gegenseite weiter.

| Modus | Bitrate je Richtung je Person | Server-Egress je Anrufstunde (2 Personen) | Server-Ingress ebenso |
|-------|-------------------------------|-------------------------------------------|----------------------|
| Audio (Opus) | ~50 kbit/s | ~45 MB | ~45 MB |
| Video 720p | ~1,2–2,5 Mbit/s (Standard-Limit in App: `calls.limits.maxBitrateKbps` = 1200) | ~1,1–2,25 GB | ~1,1–2,25 GB |

- **TURN-Relay** (Clients hinter restriktiven NATs): Verkehr läuft Client → TURN → SFU auf
  demselben Server ⇒ für betroffene Teilnehmende **verdoppelt** sich der Server-Verkehr.
  Annahme: 10–20 % der Verbindungen benötigen TURN.
- **Kapazität statt Volumen ist der Engpass:** bei 1 Gbit/s und 720p mit 2,5 Mbit/s je Richtung
  belegt ein Anruf ~5 Mbit/s Egress ⇒ grob 150 gleichzeitige Videoanrufe bei 75 % Auslastung,
  mit TURN-Anteil weniger. CPU-Bedarf des SFU vor Livebetrieb mit Lasttest messen.
- **Volumenkosten:** viele Hoster enthalten 20 TB+ Traffic; darüber Annahme 1–10 €/TB.
  Beispiel: 2.500 Premium-Mitglieder × 3 h Video/Monat × ~0,7 GB (Anteil je Person) ≈ 5 TB/Monat.
- Budgetsteuerung im Backend: `calls.limits` (Minuten, Anrufe/Tag, Video an/aus, Bitrate, Monatsbudget).

## 4. Variable Kosten je Vorgang (Annahmen)

| Posten | Annahme | Bemerkung |
|--------|---------|-----------|
| Identitäts-/Altersprüfung | **0,50–2,50 € je Prüfung** (Annahme) | auch abgebrochene/abgelehnte Prüfungen können kosten; Annahme 10–30 % Mehrversuche |
| Zahlungsabwicklung High-Risk (Adult/Dating) | **10–15 % vom Bruttobetrag** (Annahme) | ggf. zzgl. Fixgebühr je Transaktion, Setup-/Monatsgebühren |
| Rückbuchung (Chargeback) | Annahme 15–25 € je Fall, Quote 0,5–1 % | ⇒ ~0,08–0,25 € je Zahlung |
| Rolling Reserve | Annahme 5–10 % für 3–6 Monate | Liquiditätseffekt, keine Kosten – Kapitalbedarf einplanen |
| Support-Stunde | Annahme 20–35 € (inkl. Nebenkosten) | Moderation und Support |
| Gold-Partyrabatt | 10 € je eingelöstem Ticket | trägt eropub; steuerliche Behandlung klären (hier konservativ ohne Vorsteuer) |

## 5. Bewertung: Premium-Einführungspreis 7 €

Deckungsbeitrag **je zahlendem Premium-Mitglied und Monat** (ohne Fixkosten wie Entwicklung,
Recht, Buchhaltung, Datenschutz, Versicherung, Marketing):

| Posten | günstig | Basis | ungünstig | Herleitung |
|--------|--------:|------:|----------:|-----------|
| Bruttopreis | 7,00 | 7,00 | 7,00 | |
| − USt 19 % | −1,12 | −1,12 | −1,12 | Netto 5,88 € |
| − Zahlungsgebühr | −0,70 | −0,88 | −1,05 | 10 / 12,5 / 15 % von brutto |
| − Chargeback-Anteil | −0,08 | −0,15 | −0,25 | s. o. |
| − Verifizierung (umgelegt) | −0,06 | −0,47 | −2,71 | Gebühr × verifizierte Mitglieder je Zahler × Mehrversuche ÷ Verweildauer: 0,50×2×1,1÷18 / 1,50×3×1,25÷12 / 2,50×5×1,3÷6 |
| − Anrufe (Traffic/Kapazitätsanteil) | −0,01 | −0,05 | −0,10 | bei inkludiertem Traffic gering |
| − Infrastruktur-Anteil | −0,06 | −0,10 | −0,16 | Serverkosten ÷ Zahlende |
| − Support/Moderation (umgelegt) | −0,67 | −1,67 | −3,50 | 0,5/1/1,5 min × 20/25/35 €/h × 4 Mitglieder je Zahler |
| **Deckungsbeitrag** | **4,30** | **2,56** | **−1,91** | |

Zum Vergleich regulär 14 € (gleiche Annahmen): Netto 11,76 € ⇒ Deckungsbeitrag ca. **7,57 €** (Basis),
**2,92 €** (ungünstig).

Einordnung:

- Der 7-€-Preis trägt im Basisszenario die variablen Kosten, lässt aber wenig Beitrag für
  Fixkosten. Im ungünstigen Szenario (teure Verifizierung, viele unbezahlte verifizierte
  Konten, hoher Supportaufwand) ist er **negativ**.
- Größte Hebel: Verhältnis verifizierte Mitglieder zu Zahlenden, Verifizierungspreis und
  Support-Minuten je Mitglied – nicht Server oder LiveKit.
- Die 24-monatige Bindung des Einführungspreises verschiebt die Umstellung auf 14 € weit in die
  Zukunft; die Preisänderung erfordert Vorankündigung (Code: 30 Tage) und anbieterseitige
  Umsetzung (CCBill-Prozess offen, siehe Adapter-Hinweise).
- Empfehlung: Kennzahlen „Kosten je Verifizierung“, „verifizierte Mitglieder je Zahler“ und
  „Support-Minuten je Mitglied“ ab Start monatlich erheben und dieses Modell aktualisieren.

## 6. Gold (25 €) mit Partyrabatt

Netto 21,01 €; Basis-Annahmen wie oben (Anrufe 0,10 €) ⇒ Deckungsbeitrag ~15,39 € ohne Rabatt.
Je eingelöstem 10-€-Ticket sinkt er um 10 € (bei 1 Ticket/Monat ⇒ ~5,39 €; ab 2 Tickets/Monat
negativ). Einlösungen pro Mitglied und Zeitraum daher begrenzen und monatlich auswerten.

## 7. Token (20 Token = 5 €)

5,00 € brutto ⇒ 4,20 € netto ⇒ nach 10–15 % Zahlungsgebühr **3,45–3,70 €** je Paket
(ohne Chargeback-Anteil; bei Fixgebühren je Transaktion trifft es kleine Pakete überproportional).
Geschenke kosten 1–5 Token (0,25–1,25 € brutto). Umsatzsteuerliche Behandlung von Token als
Guthaben/Gutschein (Zeitpunkt der Steuerentstehung) und Umgang mit nicht eingelösten Token
mit Steuerberatung klären.

## 8. Nicht enthalten

Entwicklung/Wartung, Rechtsberatung (Jugendschutz, AGB, DSGVO), Datenschutzbeauftragte/r,
Buchhaltung/Steuer, Versicherungen, Marketing, Anbieter-Setupgebühren, Rücklagen,
Ausfall-/Sicherheitsvorfälle. **Eine Rentabilität ist nicht zugesichert.**
