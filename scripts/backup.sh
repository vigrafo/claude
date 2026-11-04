#!/usr/bin/env bash
# eropub.com – nächtliches Backup (PostgreSQL + Medien-Bucket) in ein verschlüsseltes restic-Repository.
#
# Ablauf:
#   1. pg_dump -Fc (konsistenter Snapshot) + Plausibilitätsprüfung via pg_restore --list
#   2. separater CSV-Export der Tabelle "DeletionTombstone" (für Löschungs-Reapply nach Restore)
#   3. MinIO-Bucket lesend in lokales Verzeichnis spiegeln (Compose-Dienst media-backup)
#   4. restic backup (Ende-zu-Ende-verschlüsselt, Ziel außerhalb des Servers)
#   5. optional: Aufbewahrung anwenden (--prune) und Repository prüfen (--check)
#
# Ohne --run passiert nichts. Löschen alter Snapshots nur mit --prune.
#
# Konfiguration: /etc/eropub/backup.env (chmod 600, root), Beispiel:
#   COMPOSE_DIR=/opt/eropub
#   BACKUP_STAGING=/var/backups/eropub
#   RESTIC_REPOSITORY=sftp:u123456@u123456.your-storagebox.de:/eropub-restic
#   RESTIC_PASSWORD_FILE=/etc/eropub/restic-password
#   KEEP_DAILY=7  KEEP_WEEKLY=4  KEEP_MONTHLY=6
#   LOCAL_DUMP_KEEP_DAYS=3
#   HEALTHCHECK_URL=https://uptime.example.org/api/push/XXXX   # optional (Uptime Kuma Push / healthchecks.io)
#
# Cron (root), z. B. täglich 03:17:
#   17 3 * * * /opt/eropub/scripts/backup.sh --run --prune >>/var/log/eropub-backup.log 2>&1
# Wöchentlich zusätzlich Integritätsprüfung:
#   47 4 * * 0 /opt/eropub/scripts/backup.sh --run --prune --check >>/var/log/eropub-backup.log 2>&1
set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
Verwendung: backup.sh --run [--prune] [--check] [--skip-media] [--no-upload] [--config DATEI]

  --run         Backup tatsächlich ausführen (ohne diesen Schalter: nur Hilfe)
  --prune       Aufbewahrungsregel anwenden (restic forget --prune); löscht ALTE Snapshots
  --check       restic check --read-data-subset=5% nach dem Backup
  --skip-media  Medien-Bucket nicht spiegeln (nur Datenbank)
  --no-upload   nur lokale Dumps erzeugen, kein restic (Test/Notfall)
  --config F    Konfigurationsdatei (Standard: /etc/eropub/backup.env)
EOF
}

RUN=0 PRUNE=0 CHECK=0 SKIP_MEDIA=0 NO_UPLOAD=0
CONFIG=/etc/eropub/backup.env
while [[ $# -gt 0 ]]; do
  case "$1" in
    --run) RUN=1 ;;
    --prune) PRUNE=1 ;;
    --check) CHECK=1 ;;
    --skip-media) SKIP_MEDIA=1 ;;
    --no-upload) NO_UPLOAD=1 ;;
    --config) CONFIG="${2:?--config braucht einen Pfad}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done
[[ $RUN -eq 1 ]] || { usage; exit 2; }

[[ -r "$CONFIG" ]] || { echo "Konfiguration $CONFIG fehlt/nicht lesbar." >&2; exit 2; }
# shellcheck source=/dev/null
source "$CONFIG"

: "${COMPOSE_DIR:?COMPOSE_DIR fehlt}"
: "${BACKUP_STAGING:?BACKUP_STAGING fehlt}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
LOCAL_DUMP_KEEP_DAYS="${LOCAL_DUMP_KEEP_DAYS:-3}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
if [[ $NO_UPLOAD -eq 0 ]]; then
  : "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt}"
  : "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt}"
  export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
  command -v restic >/dev/null || { echo "restic nicht installiert (apt install restic)." >&2; exit 2; }
fi

COMPOSE=(docker compose --project-directory "$COMPOSE_DIR" -f "$COMPOSE_DIR/docker-compose.prod.yml")
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DB_DIR="$BACKUP_STAGING/db"
MEDIA_DIR="$BACKUP_STAGING/media"
LOCK="$BACKUP_STAGING/.backup.lock"

log() { printf '%s [backup] %s\n' "$(date -u +%FT%TZ)" "$*"; }

notify() {
  # $1 = "" (Erfolg) | "/fail"
  [[ -n "$HEALTHCHECK_URL" ]] || return 0
  curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}$1" >/dev/null || log "WARN: Healthcheck-Ping fehlgeschlagen"
}

on_error() {
  local rc=$?
  log "FEHLER (Exit $rc) in Zeile ${BASH_LINENO[0]} – Backup NICHT vollständig."
  notify "/fail"
  exit "$rc"
}
trap on_error ERR

mkdir -p "$DB_DIR" "$MEDIA_DIR"
chmod 700 "$BACKUP_STAGING" "$DB_DIR"

exec 9>"$LOCK"
flock -n 9 || { log "Anderes Backup läuft bereits – Abbruch."; exit 1; }

# ── 1. Datenbank ─────────────────────────────────────────────────────────────
DUMP="$DB_DIR/eropub-$TS.dump"
log "pg_dump → $DUMP"
"${COMPOSE[@]}" exec -T postgres pg_dump -U eropub -d eropub -Fc --compress=6 >"$DUMP.partial"
"${COMPOSE[@]}" exec -T postgres pg_restore --list <"$DUMP.partial" >/dev/null
mv "$DUMP.partial" "$DUMP"
log "Dump OK ($(du -h "$DUMP" | cut -f1))"

# ── 2. Lösch-Register separat ────────────────────────────────────────────────
TOMB="$DB_DIR/tombstones-$TS.csv"
"${COMPOSE[@]}" exec -T postgres psql -U eropub -d eropub -v ON_ERROR_STOP=1 -q \
  -c '\copy "DeletionTombstone" TO STDOUT WITH (FORMAT csv, HEADER true)' >"$TOMB"
log "Tombstones: $(( $(wc -l <"$TOMB") - 1 )) Einträge"

# ── 3. Medien ────────────────────────────────────────────────────────────────
if [[ $SKIP_MEDIA -eq 0 ]]; then
  log "Medien-Bucket spiegeln → $MEDIA_DIR"
  BACKUP_MEDIA_DIR="$MEDIA_DIR" "${COMPOSE[@]}" --profile tools run --rm -T media-backup
fi

# ── 4. Upload (restic, verschlüsselt) ────────────────────────────────────────
if [[ $NO_UPLOAD -eq 0 ]]; then
  log "restic backup"
  restic backup --no-scan --tag eropub --tag "run-$TS" "$DB_DIR" "$MEDIA_DIR"
  if [[ $PRUNE -eq 1 ]]; then
    log "restic forget --prune (d=$KEEP_DAILY w=$KEEP_WEEKLY m=$KEEP_MONTHLY)"
    restic forget --tag eropub --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" \
      --keep-monthly "$KEEP_MONTHLY" --prune
  fi
  if [[ $CHECK -eq 1 ]]; then
    log "restic check (5 % Stichprobe)"
    restic check --read-data-subset=5%
  fi
fi

# ── 5. Lokale Staging-Dumps begrenzen (nur eigene Dateien im Staging-Verzeichnis) ──
find "$DB_DIR" -maxdepth 1 -type f \( -name 'eropub-*.dump' -o -name 'tombstones-*.csv' \) \
  -mtime +"$LOCAL_DUMP_KEEP_DAYS" -print -delete

log "Backup erfolgreich."
notify ""
