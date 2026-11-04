#!/usr/bin/env bash
# eropub – Installation/Update auf einem Plesk-Server (Docker + Plesk-nginx als HTTPS-Frontend).
#
#   bash scripts/install-plesk.sh eropub.com            # Erstinstallation im TESTMODUS
#   bash scripts/install-plesk.sh eropub.com --update   # Update nach "git pull"
#
# Testmodus (Standard): APP_ENV=staging, simulierte Zahlung/Verifizierung, keine echten E-Mails,
# Suchmaschinen gesperrt. Für den echten Livebetrieb später in .env.production APP_ENV=production
# und ENABLE_TEST_ADAPTERS=false setzen (siehe docs/ubuntu-deployment.md).
#
# Das Skript ist wiederholbar: vorhandene Secrets/.env.production werden NIE überschrieben,
# Datenbank und Fotos (Docker-Volumes) bleiben erhalten. Es führt KEIN "down -v" aus.
set -euo pipefail

DOMAIN="${1:-}"
MODE="${2:-install}"
if [[ -z "$DOMAIN" || "$DOMAIN" == --* ]]; then
  echo "Aufruf: bash scripts/install-plesk.sh <domain> [--update]   (z. B. eropub.com)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
say() { printf '\n\033[1;31m▶\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mFEHLER:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Voraussetzungen ───────────────────────────────────────────────────────────
command -v docker >/dev/null || die "Docker fehlt. In Plesk: Erweiterungen → „Docker“ installieren (oder Docker Engine laut docs/ubuntu-deployment.md)."
docker compose version >/dev/null 2>&1 || die "Docker Compose (Plugin) fehlt: apt install docker-compose-plugin (Docker-Repository) – siehe docs/ubuntu-deployment.md."
CV="$(docker compose version --short 2>/dev/null | sed 's/^v//')"
if [[ "$(printf '%s\n' "2.24.0" "$CV" | sort -V | head -1)" != "2.24.0" ]]; then
  die "Docker Compose $CV ist zu alt (mindestens 2.24 nötig)."
fi
command -v openssl >/dev/null || die "openssl fehlt (apt install openssl)."
docker info >/dev/null 2>&1 || die "Docker läuft nicht oder fehlende Rechte (als root bzw. mit sudo ausführen)."

DC=(docker compose -f docker-compose.prod.yml -f docker-compose.plesk.yml)
export EROPUB_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo local)"

# ── Secrets & Konfiguration (nur beim ersten Mal) ─────────────────────────────
mkdir -p secrets && chmod 700 secrets
gen() { [[ -s "secrets/$1" ]] || { eval "$2" > "secrets/$1"; chmod 600 "secrets/$1"; echo "  secrets/$1 erzeugt"; }; }
say "Secrets prüfen"
gen postgres_password "openssl rand -hex 24"
gen valkey_password "openssl rand -hex 24"
gen minio_root_user "echo eropub-root"
gen minio_root_password "openssl rand -hex 32"
if [[ ! -s secrets/livekit_keys ]]; then
  echo "lk$(openssl rand -hex 8): $(openssl rand -hex 32)" > secrets/livekit_keys
  chmod 600 secrets/livekit_keys
  echo "  secrets/livekit_keys erzeugt"
fi

if [[ ! -f .env.production ]]; then
  say "Erzeuge .env.production für https://$DOMAIN (TESTMODUS)"
  PG="$(cat secrets/postgres_password)"; VK="$(cat secrets/valkey_password)"
  LK_KEY="$(cut -d: -f1 secrets/livekit_keys)"; LK_SECRET="$(cut -d' ' -f2 secrets/livekit_keys)"
  umask 077
  cat > .env.production <<EOF
# Erzeugt von scripts/install-plesk.sh am $(date -Iseconds) – Werte nie committen.
APP_URL=https://$DOMAIN
# TESTMODUS: staging erlaubt simulierte Zahlung/Verifizierung. Für Livebetrieb: production + ENABLE_TEST_ADAPTERS=false
APP_ENV=staging
ENABLE_TEST_ADAPTERS=true
# Suchmaschinen gesperrt (robots.txt Disallow, X-Robots-Tag, Meta-Robots)
ALLOW_SEARCH_INDEXING=false
DATABASE_URL=postgresql://eropub:$PG@postgres:5432/eropub?schema=public
REDIS_URL=redis://:$VK@valkey:6379/0
SESSION_SECRET=$(openssl rand -hex 48)
# WICHTIG: zusätzlich offline sichern – ohne diesen Schlüssel sind verschlüsselte Daten (MFA, Anbieter-Secrets) verloren
DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
TEST_PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 24)
IDENTITY_WEBHOOK_SECRET=
STORAGE_DRIVER=local
STORAGE_DIR=/app/storage
# E-Mail: log = es wird nichts versendet (Bestätigungslink erscheint im Testmodus auf der Seite)
MAIL_MODE=log
MAIL_FROM=eropub.com <info@$DOMAIN>
# Anrufe: leer = deaktiviert. Aktivieren siehe docs/ubuntu-deployment.md (Abschnitt Plesk, Anrufe)
LIVEKIT_URL=
LIVEKIT_PUBLIC_URL=wss://rtc.$DOMAIN
LIVEKIT_API_URL=http://livekit:7880
LIVEKIT_API_KEY=$LK_KEY
LIVEKIT_API_SECRET=$LK_SECRET
CALLS_FORCE_RELAY=true
EOF
  chmod 600 .env.production
  echo "  .env.production erzeugt (chmod 600)"
else
  echo "  .env.production existiert – wird nicht verändert"
fi

# ── Bauen & starten ──────────────────────────────────────────────────────────
say "Baue Images (dauert beim ersten Mal einige Minuten)"
"${DC[@]}" build web worker

say "Starte Datenbank und Cache"
"${DC[@]}" up -d postgres valkey

say "Datenbankmigrationen"
"${DC[@]}" run --rm migrate

say "Stammdaten (idempotent: Rollen, Tarife, Fragen, Themenbereiche, Länder)"
"${DC[@]}" run --rm --no-deps web npx --no-install tsx prisma/seed.ts

say "Starte Anwendung und Worker"
"${DC[@]}" up -d web worker

say "Warte auf Healthcheck"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
[[ "${OK:-0}" == 1 ]] || die "Die Anwendung antwortet nicht auf 127.0.0.1:3000. Logs: ${DC[*]} logs --tail=100 web"
curl -fsS http://127.0.0.1:3000/api/health; echo

if [[ "$MODE" == "--update" ]]; then
  say "Update abgeschlossen."
  exit 0
fi

cat <<EOF

────────────────────────────────────────────────────────────────────────────
 Die Anwendung läuft lokal auf 127.0.0.1:3000. Jetzt in Plesk (Domain $DOMAIN):

 1. SSL/TLS-Zertifikate → Let's Encrypt für $DOMAIN und www.$DOMAIN ausstellen,
    „Permanente 301-Weiterleitung von HTTP zu HTTPS“ aktivieren.

 2. Hosting & DNS → Apache & nginx-Einstellungen:
    - „Proxy-Modus“ AUS (nginx bedient die Domain selbst)
    - „Zusätzliche nginx-Anweisungen“ – Inhalt einfügen aus:
        $ROOT/deploy/plesk-nginx.conf

 3. Ersten Admin anlegen (mit Authenticator-App, z. B. Google Authenticator):
        cd $ROOT && ${DC[*]} run --rm -it web npm run admin:bootstrap

 Danach: https://$DOMAIN  (Mitglieder)  ·  https://$DOMAIN/admin  (Verwaltung)
 Update später:  git pull && bash scripts/install-plesk.sh $DOMAIN --update
────────────────────────────────────────────────────────────────────────────
EOF
