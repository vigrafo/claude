# Backup und Wiederherstellung

Gesichert werden: **PostgreSQL** (alle Fach- und Auditdaten), **Medien-Bucket** (MinIO) und
separat das **Lösch-Register** (`DeletionTombstone`). Nicht im Backup-Repository, sondern getrennt
und offline verwahrt: `.env.production`, `secrets/*`, insbesondere `DATA_ENCRYPTION_KEY`
(ohne diesen Schlüssel sind verschlüsselte Felder im Backup unbrauchbar) und das restic-Passwort.

> Status: Skripte sind syntaktisch geprüft (`bash -n`), aber noch nicht gegen eine laufende
> Produktionsumgebung ausgeführt. Vor dem ersten Ernstfall mindestens eine Wiederherstellungsprobe.

## Verfahren

| Baustein | Werkzeug | Häufigkeit |
|----------|----------|------------|
| DB-Dump | `pg_dump -Fc` im Postgres-Container, Prüfung per `pg_restore --list` | täglich (nachts) + vor jedem Update |
| Lösch-Register | `\copy "DeletionTombstone"` als CSV | mit jedem DB-Dump |
| Medien | `mc mirror` (Dienst `media-backup`, nur lesend) in lokales Staging | täglich |
| Verschlüsselung + Off-Site | **restic** (AES-256, clientseitig) auf Ziel außerhalb des Servers | täglich |
| Aufbewahrung | `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune` | täglich |
| Integrität | `restic check --read-data-subset=5%` | wöchentlich |

Alternative zu restic: Dumps mit **age** verschlüsseln (`age -r <public-key> -o x.dump.age x.dump`)
und per `rclone`/`rsync` übertragen. restic ist gewählt, weil Verschlüsselung, Deduplizierung
(Medien!) und Aufbewahrung in einem Werkzeug liegen.

**Off-Site-Ziel:** z. B. Storage-Box/SFTP oder S3-Bucket eines anderen Anbieters, in der EU,
eigener Zugang nur für Backups. Der Server sollte, wenn möglich, nur schreiben/anhängen dürfen
(z. B. restic `rest-server --append-only`), damit ein kompromittierter Server Backups nicht löschen kann;
`--prune` läuft dann von einem separaten, vertrauenswürdigen Rechner.

## Einrichtung

```bash
sudo apt install -y restic
sudo install -d -m 700 /etc/eropub /var/backups/eropub
openssl rand -base64 48 | sudo tee /etc/eropub/restic-password >/dev/null
sudo chmod 600 /etc/eropub/restic-password
sudo tee /etc/eropub/backup.env >/dev/null <<'EOF'
COMPOSE_DIR=/opt/eropub
BACKUP_STAGING=/var/backups/eropub
RESTIC_REPOSITORY=sftp:backup-user@backup.example.net:/eropub-restic
RESTIC_PASSWORD_FILE=/etc/eropub/restic-password
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=6
LOCAL_DUMP_KEEP_DAYS=3
HEALTHCHECK_URL=
EOF
sudo chmod 600 /etc/eropub/backup.env
sudo bash -c 'set -a; . /etc/eropub/backup.env; restic init'
```

restic-Passwort zusätzlich im Passwortmanager und offline (Papier/Tresor) hinterlegen.
Ohne Passwort ist das Repository nicht wiederherstellbar.

Cron (`sudo crontab -e`):

```cron
17 3 * * 1-6 /opt/eropub/scripts/backup.sh --run --prune >>/var/log/eropub-backup.log 2>&1
17 3 * * 0   /opt/eropub/scripts/backup.sh --run --prune --check >>/var/log/eropub-backup.log 2>&1
```

Logrotation für `/var/log/eropub-backup.log` über `/etc/logrotate.d/` einrichten.

### Überwachung

- `HEALTHCHECK_URL` auf einen Push-Monitor setzen (Uptime Kuma „Push“, healthchecks.io o. ä.).
  Das Skript pingt bei Erfolg `<URL>` und bei Fehler `<URL>/fail`. Bei Uptime Kuma ggf. die
  Fehler-URL anpassen (`?status=down`). Ausbleibender Ping > 26 h ⇒ Alarm.
- Zusätzlich wöchentlich prüfen: `restic snapshots --latest 3`, Größe/Dauer plausibel.
- Details: `docs/monitoring.md`.

## Wiederherstellungsprobe (Drill) – mindestens monatlich

1. **Datenbank isoliert prüfen** (berührt die Produktion nicht):
   ```bash
   sudo scripts/restore-test.sh --from-restic latest --config /etc/eropub/backup.env
   # oder lokal:
   sudo scripts/restore-test.sh --dump /var/backups/eropub/db/eropub-<TS>.dump \
        --tombstones /var/backups/eropub/db/tombstones-<TS>.csv
   ```
   Startet einen Wegwerf-Postgres in einem internen Netz ohne Host-Ports, spielt den Dump ein,
   gibt Plausibilitätswerte aus (Tabellen, letzte Migration, Benutzer, Outbox, Löschanträge,
   Tombstones) und entfernt danach nur die eigenen Testressourcen.
2. **Vollständige App-Probe** (optional, quartalsweise): eigenes Compose-Projekt mit
   anderem Projektnamen und **ohne** veröffentlichte Ports, z. B. auf einem separaten Testserver:
   `docker compose -p eropub-restore -f docker-compose.prod.yml …` mit eigener
   `.env.production` (gleicher `DATA_ENCRYPTION_KEY`, sonst andere Secrets, `MAIL_MODE=log`,
   Zahlungs-/Identitätsanbieter deaktiviert). Nie auf demselben Host mit Projektname `eropub`.
3. Ergebnis (Datum, Snapshot, Dauer, Auffälligkeiten) im Betriebsprotokoll festhalten.

## Wiederherstellung in Produktion

Nur nach Entscheidung durch Verantwortliche/n, mit Protokoll. **Nie über Produktion
wiederherstellen, ohne vorher ein frisches Backup des aktuellen Zustands zu ziehen** – auch
ein defekter Zustand kann später benötigt werden (Forensik, Nachbuchungen).

```bash
cd /opt/eropub
DC="docker compose -f docker-compose.prod.yml"

# 0. Wartungsmodus (Admin-Backend: features.maintenanceMode) bzw. web/worker stoppen
$DC stop web worker caddy

# 1. Frisches Backup des IST-Zustands (ohne Prune!)
sudo scripts/backup.sh --run

# 2. Gewünschten Snapshot holen und isoliert prüfen
sudo scripts/restore-test.sh --from-restic <SNAPSHOT-ID>
sudo bash -c 'set -a; . /etc/eropub/backup.env; restic restore <SNAPSHOT-ID> --target /var/backups/eropub/restore --include /var/backups/eropub/db'

# 3. Datenbank ersetzen (destruktiv – nur hier, bewusst):
$DC exec -T postgres psql -U eropub -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE eropub WITH (FORCE);' -c 'CREATE DATABASE eropub OWNER eropub;'
$DC exec -T postgres pg_restore -U eropub -d eropub --exit-on-error \
  < /var/backups/eropub/restore/var/backups/eropub/db/eropub-<TS>.dump

# 4. Lösch-Register auf neuesten Stand bringen (siehe unten), dann Migrationen
$DC run --rm migrate

# 5. Medien (falls nötig) zurückspiegeln – vorher Umfang prüfen
#    restic restore … --include /var/backups/eropub/media  → mit mc mirror in den Bucket

# 6. Start, Löschungen erneut anwenden, prüfen
$DC up -d
```

### Löschungen nach Restore erneut anwenden (Pflicht)

Ein älteres Backup enthält Daten von Personen, deren Löschung **nach** dem Backup-Zeitpunkt
abgeschlossen wurde. Diese Löschungen müssen vor Wiederaufnahme des Betriebs erneut greifen:

1. Neuesten Tombstone-Export (CSV aus dem *frischen* Backup aus Schritt 1, nicht aus dem
   wiederhergestellten Snapshot) in die Tabelle `DeletionTombstone` übernehmen, fehlende Zeilen ergänzen:
   ```bash
   docker cp /var/backups/eropub/db/tombstones-<NEUESTER-TS>.csv "$($DC ps -q postgres)":/tmp/tombstones.csv
   $DC exec -T postgres psql -U eropub -d eropub -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   CREATE TEMP TABLE t (LIKE "DeletionTombstone");
   \copy t FROM '/tmp/tombstones.csv' WITH (FORMAT csv, HEADER true)
   INSERT INTO "DeletionTombstone" SELECT * FROM t ON CONFLICT DO NOTHING;
   COMMIT;
   SQL
   $DC exec -T postgres rm -f /tmp/tombstones.csv
   ```
2. Worker mit **`npm run worker -- --reapply-deletions`** ausführen (wendet alle Tombstones auf die wiederhergestellten
   Daten an; Daten **und** Medienobjekte). Auslösung gemäß Worker-Dokumentation bzw. Admin-Backend.
3. Kontrolle: keine aktiven Datensätze mehr zu Tombstone-Subjekten; Ergebnis protokollieren.

Ohne diesen Schritt würde ein Restore bereits gelöschte personenbezogene Daten wiederbeleben (DSGVO Art. 17).

## Was nie zu tun ist

- `docker compose down -v`, `docker volume rm eropub_pg-data`, `docker system prune --volumes` in Produktion.
- Restore direkt in Produktion ohne vorherige isolierte Probe und ohne frisches Backup.
- Backups unverschlüsselt außerhalb des Servers ablegen.
- `DATA_ENCRYPTION_KEY` oder restic-Passwort im selben Repository/Speicherort wie die Backups ablegen.
