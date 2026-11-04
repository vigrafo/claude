# Anrufe und Fotos

## Audio-/Videoanrufe (LiveKit, selbst gehostet)
**Ablauf:** Kontaktliste `/app/anrufe` → „Audio“/„Video“ → Anruffenster `/app/anrufe/[id]` (Status „klingelt“) → bei der Gegenseite erscheint auf jeder Seite ein Hinweis „ruft dich an“ (Polling alle 5 s) → Annehmen → beide treten bei.

| Regel | Umsetzung |
|---|---|
| Nur Premium/Gold, beide vollständig verifiziert, bestätigter Kontakt, keine Blockierung | `checkPair()` in `src/server/calls.ts` – bei Start, Annahme **und jedem Beitritt** |
| Kurzlebige Raumtokens mit Minimalrechten | Identität `profil:person`, nur dieser Raum, keine Admin-/Aufzeichnungs-/Datenrechte; Audio: nur Mikrofon, Video: Mikrofon + Kamera; Laufzeit = Restdauer |
| Angerufene:r erst nach Annahme | Token für Angerufene nur bei Status `active`; Annahme atomar |
| Keine automatische Kamera/Mikrofon | Buttons „Mikrofon einschalten“ / „Kamera einschalten“ |
| Klingeln, ablehnen, besetzt, verpasst (60 s), auflegen, Verbindungsfehler, Wiederverbinden | `CallRoom.tsx`, `expireRinging()`, Statuspolling |
| Gerätewechsel, Audio-Fallback ohne Kamera | Geräteauswahl (Mikrofon/Kamera/Lautsprecher), Kamerafehler beendet das Gespräch nicht |
| Entzug | Blockierung/Verifizierungsentzug/Sperre löscht den Raum serverseitig (`revokeRoom`) |
| Relaybetrieb | `CALLS_FORCE_RELAY` (Standard `true`): nur TURN-Kandidaten → IP-Adressen bleiben einander verborgen. **Benötigt TURN** (LiveKit-integriert, siehe `deploy/livekit.yaml`) |
| Limits | Einstellungen `calls.limits`: max. Minuten (sichtbarer Countdown), Anrufe/Tag, Video an/aus, max. Bitrate |
| Kein Mithören/Aufzeichnen | keine Egress-Konfiguration, keine Admin-Funktion; nur Metadaten (`CallSession`) |
| Verschlüsselung | Transportverschlüsselung (DTLS-SRTP). **Keine** Ende-zu-Ende-Verschlüsselung behauptet. |

**Getestet:** echter Videoanruf zwischen zwei Browsern über einen lokalen LiveKit-Server 1.13.11 (Playwright mit simulierter Kamera/Mikrofon): Klingeln → Hinweis bei der Gegenseite → Annahme → Bild und Ton in beide Richtungen → Auflegen wird der Gegenseite angezeigt. Ohne TURN (lokal `CALLS_FORCE_RELAY=false`). Der Relay-Betrieb mit TURN in Produktion ist **nicht** getestet.

## Fotos
| Bereich | Umsetzung |
|---|---|
| Upload | `/app/profil/fotos` (Profilbild, Galerie bis 30 Bilder), Gruppengalerie in der Gruppe, Bilder im Chat |
| Prüfung | Format anhand des Inhalts (nur JPEG/PNG/WebP; SVG, HTML, GIF, HEIC u. a. abgewiesen), Größenlimit (Einstellung), Pixel-Limit gegen Dekompressionsbomben, Mindestgröße |
| Metadaten | EXIF-Ausrichtung anwenden, dann **neu als WebP kodieren** → EXIF/GPS/IPTC/XMP/ICC entfernt; max. 2048 px |
| Speicher | privat (`STORAGE_DRIVER=s3` MinIO/S3 oder `local` außerhalb von `public/`), zufällige Schlüssel |
| Auslieferung | nur `/app/medien/[id]` nach Rechteprüfung: Mitgliedschaft, Moderation, Sichtbarkeit, Blockierung, Gruppenmitgliedschaft; `Cache-Control: private, no-store`, `nosniff`, Sandbox-CSP |
| Freigaben | „Nur ich“, „Bestätigte Kontakte“, „Verifizierte Mitglieder“; jederzeit änderbar; Löschen entfernt die Datei (außer bei rechtlicher Sicherung) |
| Moderation | neue Profil-/Galerie-/Gruppenbilder sind „in Prüfung“ und nur für die Eigentümer:in sichtbar; Admin-Vorschau mit Recht `media.moderate`, jeder Abruf protokolliert |
| Chatbilder | erst nach angenommener Anfrage; kosten wie eine Nachricht (Basis 1 Token); beim Empfang verborgen, bis „anzeigen“ geklickt wird; meldbar; für Admins nur fallbezogen |
| Rechte | Upload nur mit Bestätigung, dass Bildrechte vorliegen und alle erkennbaren Personen volljährig und einverstanden sind |
| Kontolöschung | Löschlauf entfernt auch die Bilddateien |

Offen: automatische Bilderkennung (z. B. Hash-Abgleich gegen bekannte illegale Inhalte) – vor Livebetrieb rechtlich und technisch zu bewerten; Bildvarianten/Thumbnails.
