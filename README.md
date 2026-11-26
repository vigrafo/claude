# Kilic Estrich Meisterbetrieb / K & K Rohrreinigung – Website

WordPress-Website mit Büro-Verwaltung für Fikret Kilic, Heidelberger Str. 57, 74821 Mosbach-Diedesheim.

## Inhalt

| Ordner | Was |
|---|---|
| `wordpress/kilic-betrieb/` | WordPress-Plugin „Kilic Betrieb“ (Website + Backend) |

## Was das Plugin kann

**Website (mehrere Ebenen, 23 Seiten)**
- Start, Estrich (+ Heizestrich, Fließestrich, Zementestrich, Schnellestrich, Trockenestrich, Industrie- & Gefälleestrich), Boden (+ Bodensanierung, Bodenverlegung, Ausgleichsmassen), Rohrreinigung (+ 24/7 Notdienst, Kanal-TV, Wartung), Referenzen, Über uns (+ Karriere), Angebot anfragen, Kontakt, Impressum, Datenschutz
- Hauptmenü mit Untermenüs, Footer-Menüs, Brotkrumen, Querverweise
- Anfrage-Assistent in 5 Schritten (Leistung, Objekt, m² mit Raumrechner, Estrichart, Termin, Foto-Upload, Kontakt) mit 6 Beispiel-Anfragen
- Notdienst-Nummer überall (Topbar, Banner, Footer, mobile Leiste), Nach-oben-Knopf
- Schriften lokal (DSGVO), keine externen Dienste

**Backend „Kilic Betrieb“**
- Übersicht: neue Anfragen, offene/überfällige Rechnungen, Umsatz, CSV-Export für den Steuerberater
- Anfragen aus dem Formular (inkl. Fotos), Status, Notizen, E-Mail-Benachrichtigung, Eingangsbestätigung an Kunden
- „Kunde anlegen & Angebot erstellen“ mit einem Klick aus der Anfrage
- Kunden mit Kundennummer, Privat-/Gewerbekunde, Belegübersicht
- Angebote & Rechnungen: Positionen mit Vorlagen, MwSt., fortlaufende Nummern (AN-/RE-Jahr-Nummer), Status, Zahlungseingang, Angebot → Rechnung, Kopieren
- Druckansicht DIN A4 → „Als PDF speichern“, mit Pflichtangaben (§ 14 UStG), § 35a-Lohnanteil und Aufbewahrungshinweis für Privatkunden
- Abgeschlossene Rechnungen sind gesperrt und nicht löschbar (GoBD) – Korrektur über Storno
- Referenzen mit Foto, Projektarten-Filter
- Einstellungen: Firmendaten, Notdienst-Nummer, Steuer, Bank, Nummernkreise, Belegtexte
- Rolle „Büro (Kilic)“ für Mitarbeiter ohne Admin-Rechte

## Installation auf kilic.vigrafo.de (Plesk)

1. Plesk → kilic.vigrafo.de → **WordPress** → WordPress installieren (WP Toolkit). Den Ordner `httpdocs` vorher leeren (die statische Testseite löschen).
2. WordPress-Admin → **Plugins → Installieren → Plugin hochladen** → `kilic-betrieb.zip` → aktivieren.
   Das Plugin legt automatisch alle Seiten, Menüs, die Startseite und Beispiel-Referenzen an.
3. **Kilic Betrieb → Einstellungen**: E-Mail, Steuernummer/USt-IdNr., Bankverbindung eintragen.
4. **Einstellungen → Permalinks** einmal speichern (falls Unterseiten 404 zeigen).
5. Später **Divi** installieren und aktivieren. Die Seiten sind als Divi-Abschnitte gespeichert und öffnen sich im Divi Builder; Header, Footer und Notdienst-Leiste kommen weiter aus dem Plugin.
6. Für zuverlässigen E-Mail-Versand ein SMTP-Plugin (z. B. „WP Mail SMTP“) mit dem Postfach von Kilic einrichten.

## Vor dem Livegang

Gelb markierte Platzhalter (`todo`) ersetzen: Fotos („Foto ersetzen“), Kundenstimmen (echte Google-Bewertungen), Beispiel-Referenzen, Team, Stellen, Impressum und Datenschutz (rechtlich prüfen lassen). Solange die Seite im Aufbau ist: WordPress → Einstellungen → Lesen → „Suchmaschinen davon abhalten …“ aktivieren.

## Entwicklung

Getestet mit WordPress 6.8 und PHP 8.3 (ohne Divi – Divi ist kommerziell und war für den Test nicht verfügbar).
