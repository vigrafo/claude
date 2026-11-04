#!/usr/bin/env bash
# eropub.com – Wiederherstellungsprobe in eine ISOLIERTE Wegwerf-Datenbank.
#
# Berührt die Produktion nicht: eigener Container + eigenes internes Netz (ohne Internet,
# ohne Host-Ports), eigene Namen mit Präfix. Verweigert Namen, die mit der Produktion
# kollidieren könnten, und bricht ab, wenn Ressourcen mit dem Namen schon existieren.
#
# Beispiele:
#   # Dump direkt aus dem Staging-Verzeichnis
#   scripts/restore-test.sh --dump /var/backups/eropub/db/eropub-20261104T031700Z.dump \
#       --tombstones /var/backups/eropub/db/tombstones-20261104T031700Z.csv
#
#   # aus restic (letzter Snapshot), benötigt RESTIC_REPOSITORY/RESTIC_PASSWORD_FILE
#   scripts/restore-test.sh --from-restic latest --config /etc/eropub/backup.env
#
# Ohne --keep werden NUR die von diesem Skript angelegten Testressourcen am Ende entfernt.
set -euo pipefail
umask 077

usage() {
  cat <<'EOF'
Verwendung:
  restore-test.sh --dump DATEI [--tombstones CSV] [--name NAME] [--keep]
  restore-test.sh --from-restic SNAPSHOT [--config DATEI] [--name NAME] [--keep]

  --dump F          pg_dump-Datei (-Fc)
  --tombstones F    CSV-Export von "DeletionTombstone" (Abgleich der Anzahl)
  --from-restic ID  Snapshot-ID oder "latest"; neuester Dump/CSV daraus wird verwendet
  --config F        Datei mit RESTIC_REPOSITORY/RESTIC_PASSWORD_FILE (Standard /etc/eropub/backup.env)
  --name NAME       Präfix der Testressourcen (Standard: eropub-restoretest; nie "eropub")
  --keep            Testdatenbank nach der Prüfung laufen lassen (zum manuellen Nachsehen)
EOF
}

DUMP="" TOMB="" SNAPSHOT="" CONFIG=/etc/eropub/backup.env NAME=eropub-restoretest KEEP=0
PG_IMAGE=postgres:16.15-bookworm
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump) DUMP="${2:?}"; shift ;;
    --tombstones) TOMB="${2:?}"; shift ;;
    --from-restic) SNAPSHOT="${2:?}"; shift ;;
    --config) CONFIG="${2:?}"; shift ;;
    --name) NAME="${2:?}"; shift ;;
    --keep) KEEP=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ -z "$DUMP" && -z "$SNAPSHOT" ]] || [[ -n "$DUMP" && -n "$SNAPSHOT" ]]; then
  usage >&2; exit 2
fi
if [[ ! "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || [[ "$NAME" == "eropub" ]] || [[ "$NAME" != *restore* ]]; then
  echo "Ungültiger --name '$NAME' (muss 'restore' enthalten und darf nicht 'eropub' sein)." >&2
  exit 2
fi

log() { printf '%s [restore-test] %s\n' "$(date -u +%FT%TZ)" "$*"; }

NET="$NAME-net"
PG="$NAME-postgres"
WORK="$(mktemp -d -t eropub-restore.XXXXXX)"
CREATED_NET=0 CREATED_PG=0

cleanup() {
  if [[ $KEEP -eq 0 ]]; then
    [[ $CREATED_PG -eq 1 ]] && docker rm -f "$PG" >/dev/null 2>&1 || true
    [[ $CREATED_NET -eq 1 ]] && docker network rm "$NET" >/dev/null 2>&1 || true
  else
    log "--keep: Container $PG bleibt bestehen. Entfernen: docker rm -f $PG && docker network rm $NET"
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

if docker container inspect "$PG" >/dev/null 2>&1 || docker network inspect "$NET" >/dev/null 2>&1; then
  echo "Ressourcen '$PG' oder '$NET' existieren bereits – Abbruch (nichts verändert)." >&2
  exit 1
fi

# ── Quelle beschaffen ────────────────────────────────────────────────────────
if [[ -n "$SNAPSHOT" ]]; then
  [[ -r "$CONFIG" ]] || { echo "Konfiguration $CONFIG fehlt." >&2; exit 2; }
  # shellcheck source=/dev/null
  source "$CONFIG"
  : "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}" "${BACKUP_STAGING:?}"
  export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
  log "restic restore $SNAPSHOT (nur Datenbankteil) → $WORK"
  restic restore "$SNAPSHOT" --target "$WORK/r" --include "$BACKUP_STAGING/db"
  DUMP="$(find "$WORK/r" -type f -name 'eropub-*.dump' | sort | tail -n1)"
  TOMB="$(find "$WORK/r" -type f -name 'tombstones-*.csv' | sort | tail -n1)"
  [[ -n "$DUMP" ]] || { echo "Kein Dump im Snapshot gefunden." >&2; exit 1; }
fi
[[ -r "$DUMP" ]] || { echo "Dump $DUMP nicht lesbar." >&2; exit 2; }
log "Dump: $DUMP"

# ── Isolierte Datenbank starten ──────────────────────────────────────────────
docker network create --internal "$NET" >/dev/null; CREATED_NET=1
PGPASS="$(openssl rand -hex 16)"
docker run -d --name "$PG" --network "$NET" \
  -e POSTGRES_USER=eropub -e POSTGRES_DB=eropub -e POSTGRES_PASSWORD="$PGPASS" \
  --label eropub.purpose=restore-test "$PG_IMAGE" >/dev/null; CREATED_PG=1

for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U eropub -d eropub >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG" pg_isready -U eropub -d eropub >/dev/null

# ── Wiederherstellen ─────────────────────────────────────────────────────────
log "pg_restore …"
docker exec -i "$PG" pg_restore -U eropub -d eropub --exit-on-error --no-owner --role=eropub <"$DUMP"

q() { docker exec "$PG" psql -U eropub -d eropub -At -v ON_ERROR_STOP=1 -c "$1"; }

log "Prüfungen:"
echo "  Tabellen im Schema public : $(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
echo "  Letzte Migration          : $(q 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1')"
echo "  Benutzer                  : $(q 'SELECT count(*) FROM "User"')"
echo "  Outbox (Status: Anzahl)   : $(q 'SELECT string_agg(status || ''='' || n, '', '') FROM (SELECT status, count(*) n FROM "OutboxEvent" GROUP BY status) s')"
echo "  Löschanträge offen        : $(q "SELECT count(*) FROM \"DeletionRequest\" WHERE status IN ('requested','scheduled','failed')")"
DB_TOMB="$(q 'SELECT count(*) FROM "DeletionTombstone"')"
echo "  Tombstones in DB          : $DB_TOMB"
if [[ -n "$TOMB" && -r "$TOMB" ]]; then
  CSV_TOMB=$(( $(wc -l <"$TOMB") - 1 ))
  echo "  Tombstones in CSV         : $CSV_TOMB"
  if (( CSV_TOMB > DB_TOMB )); then
    echo "  HINWEIS: CSV enthält mehr Tombstones als der Dump – nach einem echten Restore"
    echo "           CSV importieren und Worker-Job deletion.reapply ausführen (docs/backup-restore.md)."
  fi
fi

log "Wiederherstellungsprobe erfolgreich abgeschlossen."
