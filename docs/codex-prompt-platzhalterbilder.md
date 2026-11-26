# Prompt für Codex: Thematische Platzhalterbilder für das Plugin „kilic-betrieb“

> Den gesamten Text unterhalb der Linie in Codex einfügen. Repository: `vigrafo/claude`, Branch `claude/kilic-estrich-website-tkwrlw`, Plugin-Ordner `wordpress/kilic-betrieb/`.

---

## Aufgabe

Ersetze die einfarbigen SVG-Platzhalter der WordPress-Website „Kilic Estrich Meisterbetrieb / K & K Rohrreinigung“ (Mosbach) durch **thematisch passende Platzhalterfotos in den Farben der Website**. Der Inhaber tauscht sie später gegen eigene Fotos. Bis dahin soll die Seite hochwertig und stimmig aussehen.

Das Plugin liegt in `wordpress/kilic-betrieb/`. Lies zuerst diese Dateien:

- `includes/content.php`: Seiteninhalte. `kilic_img( $variante, $alt, $class )` erzeugt `<img src="{{assets}}/img/ph-<variante>.svg">`. Die Varianten sind `dunkel`, `grau`, `warm` und `blau`. Bei Hero-Bereichen kommt das Bild über den Schlüssel `'img'`, in der Einleitung über `'img2'`.
- `includes/referenzen.php` (um Zeile 98): Ersatzbild für Referenzen ohne Projektfoto, `ph-blau.svg` oder `ph-grau.svg`.
- `templates/layout.php` (Zeile 25): Hero-Ersatzbild `ph-dunkel.svg`.
- `assets/css/kilic.css`: Farben (`:root`) und Bildformate, siehe `.img-cover`, `.hero-img`, `.service-card`, `.media`, `.ba`, `.team-card`, `.project-img`.

## Farbwelt (verbindlich)

Die Bilder müssen zur Website passen. Lege über alle Bilder **eine einheitliche Farbstimmung** (Color Grading), sodass sie wie eine zusammengehörige Serie wirken.

| Rolle | Farbe | Einsatz im Bild |
|---|---|---|
| Beton / Grundton | `#efede9`, `#dedad3` | helle, warme Grautöne: Estrichflächen, Wände, Tageslicht |
| Dunkel | `#1b1f23` | tiefe Schatten, dunkle Hero-Motive, Abendstimmung |
| Estrich-Akzent | Orange `#e8892b` / `#c96f17` | warme Akzente: Werkzeuggriffe, Eimer, Kabel, Sicherheitskleidung, warmes Streiflicht |
| Rohrreinigung | Blau `#1f6fd1` / `#1756a6` | kühle Akzente nur bei Rohr-Motiven: Arbeitskleidung, Schläuche, Licht im Rohr |
| Notdienst | Rot `#d7262f` | höchstens ein kleiner Akzent beim Notdienst-Motiv, z. B. eine Warnleuchte |

Regeln für das Grading:

- **Estrich und Boden:** warm-neutral. Betongrau mit leicht warmem Weißabgleich (ca. 4500–5000 K), dazu dezente orange Akzente. Keine grünen oder violetten Farbstiche.
- **Rohrreinigung:** neutral-kühl, blaue Akzente, aber nicht kalt-türkis. Orange kommt hier nicht vor.
- Mittlere Sättigung, weicher Kontrast und matte Tiefen. Nicht übersättigt und nicht HDR-artig.
- Keine anderen Signalfarben, z. B. kein knallgrünes, gelbes oder pinkes Equipment.
- **Hero-Bilder** sind dunkel und ruhig, weil Text darüber liegt (`.hero::after` dunkelt zusätzlich ab). Die linke Bildhälfte bleibt ruhig ohne Details, das Motiv sitzt rechts.

## Allgemeine Bildregeln

- Fotorealistisch, natürliches Licht, sauber und aufgeräumt, keine Werbeästhetik.
- **Keine erkennbaren Gesichter.** Personen nur von hinten, als Hände oder angeschnitten. Es gibt keine echten Fotos vom Inhaber oder vom Team, deshalb darf nichts so aussehen, als zeige es Fikret Kilic oder Mitarbeiter.
- **Kein Text, keine Logos, keine Marken, keine Kennzeichen und keine Fahrzeugbeschriftung** im Bild.
- Fachlich korrekt: Estrich ist eine glatte, mineralische Bodenschicht im Rohbau, nicht Fliesen und nicht Parkett. Heizestrich zeigt Fußbodenheizungsrohre auf Noppenplatten. Fließestrich ist eine flüssige, glänzende Fläche. Rohrreinigung zeigt Spirale, Hochdruckschlauch, Schacht oder Kamera.
- Deutsche bzw. mitteleuropäische Bausituationen: Mauerwerk, Kunststofffenster, Rohbau-Innenräume.
- **Herkunft:** Erzeuge die Bilder mit deinem Bildgenerator. Falls du keinen hast, lade lizenzfreie Fotos (CC0, Pexels- oder Unsplash-Lizenz) herunter und lege sie lokal ab, nie per Hotlink (DSGVO). Bearbeite sie dann auf die Farbwelt oben. Dokumentiere jede Quelle in `assets/img/ph/QUELLEN.md` (Datei, Quelle, Lizenz oder „KI-generiert“).

## Dateien und Formate

Lege die Bilder in `assets/img/ph/` ab, als **WebP**, Qualität ca. 78. Ziel sind 80–250 KB pro Bild, insgesamt höchstens ca. 4 MB.

| Datei | Format (px) | Motiv | Akzent |
|---|---|---|---|
| `hero-start.webp` | 2400×1350 | Estrichleger von hinten, glättet frischen Estrich im Rohbau, Abendlicht durch Fensteröffnung, Motiv rechts | Orange |
| `hero-estrich.webp` | 2400×1350 | Weite, frisch abgezogene Estrichfläche in leerem Neubau, Streiflicht | Orange |
| `hero-boden.webp` | 2400×1350 | Heller, renovierter Altbauraum mit neuem Boden, Fenster mit weichem Licht | warm |
| `hero-rohr.webp` | 2400×1350 | Rohrreinigungstechniker von hinten an geöffnetem Abwasserschacht, Dämmerung | Blau |
| `hero-kontakt.webp` | 2400×1350 | Leerer Rohbau-Innenraum mit fertigem, glattem Estrich, ruhig und dunkel | Orange |
| `estrich-verteilen.webp` | 1600×1000 | Estrich wird mit Richtlatte abgezogen, Gummistiefel, Hände | Orange |
| `heizestrich.webp` | 1600×1000 | Fußbodenheizungsrohre auf Noppenplatten, Randdämmstreifen, kurz vor dem Einbringen | Orange |
| `fliessestrich.webp` | 1600×1000 | Calciumsulfat-Fließestrich fließt aus Schlauch, spiegelnde Oberfläche | Orange |
| `zementestrich.webp` | 1600×1000 | Erdfeuchter Zementestrich, Estrichpumpe bzw. Mischer am Bau | Orange |
| `schnellestrich.webp` | 1600×1000 | Glättmaschine (Flügelglätter) auf Estrichfläche | Orange |
| `trockenestrich.webp` | 1600×1000 | Verlegte Trockenestrich-Elemente, Akkuschrauber | Orange |
| `industrie.webp` | 1600×1000 | Große Halle mit Industrieestrich, Gefälle zu Bodenablauf | Orange, dunkel |
| `sanierung-vorher.webp` | 1200×1200 | Alter, rissiger Estrich mit Hohlstellen in Altbau | neutral |
| `sanierung-nachher.webp` | 1200×1200 | Derselbe Raumtyp mit neuem, glattem Estrich (gleiche Perspektive wie „vorher“) | warm |
| `bodenverlegung.webp` | 1600×1000 | Hände verlegen Vinyl-Designplanken auf Estrich | warm |
| `ausgleichsmasse.webp` | 1600×1000 | Selbstverlaufende Ausgleichsmasse, Stachelwalze, Spikeschuhe | Orange |
| `rohrreinigung.webp` | 1600×1000 | Rohrreinigungsspirale in Abfluss, Handschuhe | Blau |
| `notdienst.webp` | 1600×1000 | Keller bei Nacht, Stirnlampe, Werkzeugkoffer, Rückstau beseitigt | Blau + kleiner roter Akzent |
| `kanal-tv.webp` | 1600×1000 | Kanalkamera-Bild aus dem Rohrinneren bzw. Inspektionsmonitor (ohne Schrift) | Blau |
| `wartung.webp` | 1600×1000 | Revisionsschacht bzw. Hebeanlage im Gewerbekeller, sauber | Blau |
| `werkzeug-estrich.webp` | 1200×1300 | Stillleben: Glättkelle, Wasserwaage, Zollstock auf Estrich | Orange |
| `werkzeug-boden.webp` | 1200×1300 | Stillleben: Cuttermesser, Andrückrolle, Belagsmuster | warm |
| `werkzeug-rohr.webp` | 1200×1300 | Stillleben: Rohrreinigungsspirale, Handschuhe, Taschenlampe | Blau |
| `meister.webp` | 1200×1300 | Handwerksmeister von hinten bzw. angeschnitten mit Wasserwaage auf Baustelle, **kein Gesicht** | Orange |
| `ref-neubau.webp` | 1200×900 | Neubau-Innenraum mit Heizestrich | Orange |
| `ref-sanierung.webp` | 1200×900 | Altbau während Bodensanierung | neutral |
| `ref-gewerbe.webp` | 1200×900 | Gewerbehalle mit Industrieestrich | dunkel |
| `ref-boden.webp` | 1200×900 | Fertig verlegter Designboden | warm |
| `ref-rohr.webp` | 1200×900 | Rohrreinigung im Einsatz | Blau |

## Code-Änderungen

1. **`kilic_img()` in `includes/content.php`** soll zusätzlich einen Motiv-Schlüssel akzeptieren:
   - Existiert `assets/img/ph/<schluessel>.webp`, wird das Foto genutzt.
   - Sonst bleibt es beim bisherigen SVG (`dunkel|grau|warm|blau`), sodass nichts kaputtgeht.
   - Füge `width`/`height` passend zum Format hinzu. `loading="lazy"` gilt nur unterhalb des sichtbaren Bereichs; Hero-Bilder bekommen `fetchpriority="high"` und kein lazy.
2. **Jede Stelle in `content.php` auf das passende Motiv umstellen**, nach Seite und Alt-Text:
   - Hero je Seite: start → `hero-start`, estrich und Unterseiten → passendes Estrich-Motiv, boden → `hero-boden`, rohrreinigung/notdienst/kanal-tv/wartung → Rohr-Motive, angebot-anfragen und kontakt → `hero-kontakt`, referenzen → `hero-estrich`, ueber-uns/karriere → `meister`.
   - Service-Karten: „Estrich wird verteilt“ → `estrich-verteilen`, „Altbausanierung“/„Bodensanierung“ → `sanierung-nachher`, „Vinylboden“/„Bodenverlegung“ → `bodenverlegung`, „Rohrreinigung“ → `rohrreinigung`, „Ausgleichsmasse“ → `ausgleichsmasse`.
   - „Vorher“/„Nachher“ → `sanierung-vorher` / `sanierung-nachher`.
   - Inhaber- und „Über uns“-Bild → `meister`.
   - Team-Karten → Werkzeug-Stillleben passend zur Rolle: Vorarbeiter Estrich → `werkzeug-estrich`, Bodenleger → `werkzeug-boden`, Rohrreinigung → `werkzeug-rohr`, Inhaber → `meister`.
   - Unterseiten-Einleitung (`img2`): jeweils das Fachmotiv der Seite, z. B. Heizestrich → `heizestrich`.
3. **Bereits angelegte Seiten mit aktualisieren, ohne dass der Kunde „Seiteninhalte zurücksetzen“ muss.** Der Inhalt liegt in der Datenbank und enthält noch `{{assets}}/img/ph-<variante>.svg`.
   - Ergänze in `includes/frontend.php` einen `the_content`-Filter (nach den Tokens, Priorität 101).
   - Er ersetzt `ph-<variante>.svg` anhand von Alt-Text und Seiten-Slug durch das passende WebP. Lege die Zuordnung als Tabelle in einer Funktion `kilic_ph_motiv( $slug, $alt, $variante )` ab.
   - **Nur** Bilder unter `/assets/img/ph-` anfassen. Vom Kunden eingesetzte eigene Bilder (Mediathek, Divi) bleiben unverändert.
4. **`includes/referenzen.php`:** Für Referenzen ohne Projektfoto ein Ersatzbild nach Projektart (`kilic_ref_kat`) wählen: Neubau → `ref-neubau`, Sanierung → `ref-sanierung`, Gewerbe → `ref-gewerbe`, Bodenverlegung → `ref-boden`, Rohrreinigung → `ref-rohr`, sonst `ref-neubau`.
5. **`templates/layout.php`:** Hero-Ersatzbild → `hero-start.webp`.
6. **Austausch für den Kunden erleichtern:** Ergänze in `README.md` einen Abschnitt „Platzhalterbilder ersetzen“.
   - Am einfachsten im Divi-Editor das Bild anklicken und ein eigenes Foto aus der Mediathek wählen.
   - Alternativ eine Datei gleichen Namens in `assets/img/ph/` ersetzen; diese wird bei Plugin-Updates überschrieben.
   - Liste alle Dateien mit Verwendungsort auf.
7. `KILIC_VERSION` und den Plugin-Header in `kilic-betrieb.php` auf die nächste Patch-Version erhöhen.

## Rahmenbedingungen

- Keine neuen Abhängigkeiten, kein externes CDN, alle Dateien lokal (DSGVO).
- Keine bestehenden Klassen oder Funktionen umbenennen.
- `kilic.css` nur ergänzen, falls nötig, z. B. `object-position` für Hero-Motive rechts.
- Texte und Alt-Texte auf Deutsch. Alt-Texte beschreiben das Motiv sachlich, z. B. „Fließestrich wird eingebracht“.
- Bilder in der Farbwelt oben halten. Ein Bild, das farblich oder thematisch nicht passt, lieber neu erzeugen als verwenden.

## Prüfen, bevor du fertig bist

- `php -l` für alle geänderten PHP-Dateien.
- Jede in `content.php`, `referenzen.php` und `layout.php` referenzierte Datei existiert in `assets/img/ph/`. Falls vorhanden, mit `grep` und einem kleinen Skript gegenprüfen.
- Größe pro Bild ≤ 250 KB, Gesamtgröße notieren.
- Eine Kontaktbogen-Übersicht `assets/img/ph/_uebersicht.jpg` erzeugen (alle Bilder als Raster). Sie dient nur der Kontrolle und wird nicht ins Plugin-ZIP gepackt. Daran prüfen, ob die Serie farblich einheitlich wirkt.
- Commit auf Branch `claude/kilic-estrich-website-tkwrlw` mit kurzer deutscher Commit-Nachricht.
