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

**Büro-Software (Cockpit)** – erreichbar unter `/buero`
- Anmeldung im Firmendesign, danach direkt das Cockpit; Büro-Zugänge (Rolle „Büro (Kilic)“) sehen keine WordPress-Menüs
- Cockpit mit Ablauf Anfragen → Angebote → Aufträge → Rechnungen, Knöpfe direkt an jeder Karte
- Kennzahlen: offen, überfällig, Zahlungseingang Monat/Jahr, letzte Zahlungen
- Anfragen aus dem Formular (inkl. Fotos), E-Mail ans Büro, Eingangsbestätigung an den Kunden im Firmendesign mit Kopie an den Inhaber
- Angebote & Rechnungen mit Leistungskatalog, fortlaufenden Nummern (nie doppelt), jederzeit wieder bearbeitbar
- Per E-Mail an den Kunden senden – E-Mail im Firmendesign, PDF im Anhang (dompdf); jede gesendete Fassung bleibt als Kopie am Beleg
- Aufträge mit Ausführungstermin, Auftragsbestätigung (PDF/E-Mail)
- Zahlungsverkehr: Zahlungseingänge und Teilzahlungen, Status automatisch, Zahlungserinnerung (PDF/E-Mail), CSV-Export für den Steuerberater
- Kundenakte mit Verlauf (wer hat wann was gemacht) und Fotos vom Objekt – Upload direkt vom Handy
- Referenzen, Einstellungen (Firmendaten, Steuer, Bank, Logo, Nummernkreise, Texte)

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

Getestet mit WordPress 6.8 und PHP 8.3 (ohne Divi – Divi ist kommerziell und war für den Test nicht verfügbar). PDF-Erzeugung: dompdf 3 (LGPL) unter `lib/vendor`.

## Testen – immer mit Divi

Jede Änderung an Website/Template wird **mit Divi** getestet, nicht nur mit dem Standard-Theme:
Seiten aufrufen, Divi-Editor (`?et_fb=1`) öffnen, einen Text ändern, speichern und auf der
Besucherseite prüfen. Divi ist eine lizenzierte Datei des Kunden (nicht im Repository):
`Divi.zip` vom Kunden bereitstellen lassen und nach dem Test wieder vom Server löschen lassen.
Geprüft mit Divi 5.19.1.
