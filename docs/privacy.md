# Datenschutzkonzept (prüffähiger Entwurf – keine abschließende Rechtsprüfung)

Rechtsrahmen: DSGVO, insbesondere Art. 5 (Grundsätze), Art. 9 (Daten zum Sexualleben/sexuelle Orientierung; ggf. biometrische Daten), Art. 25 (Privacy by Design/Default), Art. 32 (Sicherheit), Art. 35 (DSFA). **Eine Datenschutz-Folgenabschätzung ist für dieses Angebot voraussichtlich erforderlich** und vor Livebetrieb durchzuführen.

| Datenart | Zweck | Rechtsgrundlage (Vorschlag) | Speicherort | Aufbewahrung / Löschung |
|---|---|---|---|---|
| Konto (E-Mail, Passwort-Hash) | Vertrag, Login | Art. 6 Abs. 1 lit. b | `User` | bis Kontolöschung + 7 Tage Karenz |
| Profilangaben (Interessen, Beziehungsform, Kontaktwünsche) | Matching | **Art. 9 Abs. 2 lit. a** ausdrückliche Einwilligung (freiwillige Angaben) | `CommunityProfile`, `ProfileInterest` | bis Änderung/Löschung |
| Region (Land, Region, Stadt, 2-stellige PLZ, gerundete Koordinaten 0,1°) | Umkreis/Vorschläge | lit. b | `CommunityProfile` | bis Änderung/Löschung |
| Verifizierungsergebnis | Vertrauenssignal, Jugendschutz | lit. c/f; ggf. Art. 9 lit. a bei biometrischem Abgleich beim Anbieter | `VerificationCase` (minimiert) | bis Ablauf + Nachweisfrist (zu definieren) |
| Ausweisbilder/Biometrie | Prüfung | beim Anbieter, AV-Vertrag | **nicht bei eropub** (Ausnahme: temporäre Belege mit Frist) | Anbieterfrist; temporär max. 30 Tage (Vorschlag) |
| Nachrichten | Kommunikation | lit. b | `Message` | bis Löschung durch Konto; gemeldete Inhalte als Beleg im Fall |
| Spielantworten | Spiel | lit. a/b | `GameAnswer`, `GameSubmission` | Ablaufregel offen (Vorschlag: 90 Tage nach Rundenende) |
| Zahlungen/Rechnungen | Vertrag, Steuer | lit. b/c | `Order`, `Invoice`, `Refund` | 10 Jahre (HGB/AO) – getrennt von Profildaten |
| Meldungen/Moderation | Sicherheit | lit. f/c | `Report`, `ModerationCase` | Vorschlag: 2 Jahre nach Abschluss |
| Audit | Nachvollziehbarkeit | lit. f/c | `AuditEvent` (ohne Inhalte) | Vorschlag: 3 Jahre |

## Technische Maßnahmen (umgesetzt)
- Keine öffentlichen Profile, `noindex`, keine Analytics/Tracker, selbst gehostete Schriften, keine Drittanbieter-Requests.
- Neutrale Benachrichtigungen (keine Inhalte, keine Namen); Admin-Mails nur mit Fallnummer + Link.
- Grobe Standortdaten; Entfernung nur in Stufen.
- Admins ohne pauschalen Zugriff auf Nachrichten, Spielantworten oder Belege; Fallzugriff mit Zweck + Audit.
- Export (Art. 15/20) und Löschung nur für das eingeloggte Konto selbst.
- Löschlauf durch Worker; `DeletionTombstone` + `--reapply-deletions` nach Restore.
- Secrets verschlüsselt (AES-256-GCM), Logs ohne Inhalte, IPs nur gehasht.

## Offen
DSFA, Verzeichnis der Verarbeitungstätigkeiten, AV-Verträge (Hosting, Mail, Zahlung, Identität), finale Fristen, Einwilligungstexte für Art.-9-Angaben (UI-Einwilligung beim ersten Speichern sensibler Profilfelder ist als Erweiterung vorgesehen), Datenschutzerklärung.
