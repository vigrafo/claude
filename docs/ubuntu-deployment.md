# Deployment auf Ubuntu 24.04 LTS

Zielbild: ein Server, alle Dienste per Docker Compose (`docker-compose.prod.yml`).
Öffentlich nur Caddy (80/443) und LiveKit (RTC/TURN). Datenbank, Cache und Objektspeicher
sind nicht vom Host oder Internet erreichbar.

> Status: Konfiguration ist syntaktisch geprüft (`docker compose config`), aber noch nicht auf
> einem echten Server end-to-end getestet. Erstinbetriebnahme zuerst auf Staging (eropub.de).

## 1. Server-Grundlagen

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw unattended-upgrades restic jq
sudo dpkg-reconfigure -plow unattended-upgrades
sudo timedatectl set-timezone Europe/Berlin
```

- SSH nur per Schlüssel (`PasswordAuthentication no`, `PermitRootLogin prohibit-password` bzw. `no`).
- Eigener Admin-Benutzer mit `sudo`; Root-Login deaktivieren.
- Firewall: siehe `deploy/ufw-docker.md` (Docker-Ports umgehen UFW!).

## 2. Docker Engine (offizielles Docker-apt-Repository)

Quelle: <https://docs.docker.com/engine/install/ubuntu/> – dort aktuellen Stand prüfen.
**Nicht** das Ubuntu-Paket `docker.io` und nicht Snap verwenden.

```bash
# Alte/konfliktbehaftete Pakete entfernen (falls vorhanden)
for p in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y $p; done

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run --rm hello-world
docker compose version   # ≥ 2.24 erforderlich (für docker-compose.plesk.yml)
```

Log-Rotation ist pro Dienst in Compose gesetzt (json-file, 5×20 MB).

## 3. DNS

| Name              | Typ        | Wert                                   |
|-------------------|------------|----------------------------------------|
| `eropub.com`      | A / AAAA   | IPv4 / IPv6 des Servers                |
| `www.eropub.com`  | A / AAAA   | IPv4 / IPv6 des Servers (→ Redirect)   |
| `rtc.eropub.com`  | A / AAAA   | IPv4 / IPv6 des Servers (LiveKit)      |
| `eropub.com`      | MX, TXT    | siehe `docs/mail-dns.md` (MX, SPF, DKIM, DMARC) |
| `eropub.com`      | CAA        | `0 issue "letsencrypt.org"` (empfohlen) |

AAAA nur setzen, wenn IPv6 am Server tatsächlich funktioniert (sonst schlägt ACME/Erreichbarkeit fehl).
Reverse-DNS (PTR) der Server-IP auf `eropub.com` o. ä. setzen, falls der Server selbst Mails versendet.

## 4. Code und Konfiguration

```bash
sudo mkdir -p /opt/eropub && sudo chown "$USER": /opt/eropub
git clone <REPO-URL> /opt/eropub && cd /opt/eropub
```

### Secrets erzeugen

```bash
cd /opt/eropub
mkdir -p secrets && chmod 700 secrets
openssl rand -hex 24 > secrets/postgres_password
openssl rand -hex 24 > secrets/valkey_password
echo "eropub-root"   > secrets/minio_root_user
openssl rand -hex 32 > secrets/minio_root_password
LK_KEY="lk$(openssl rand -hex 8)"; LK_SECRET="$(openssl rand -base64 48 | tr -d '\n/+=')"
echo "$LK_KEY: $LK_SECRET" > secrets/livekit_keys
chmod 600 secrets/*

cp .env.example .env.production && chmod 600 .env.production
```

In `.env.production` setzen (Werte aus den Dateien oben übernehmen):

| Variable | Produktionswert |
|----------|-----------------|
| `APP_ENV` | `production` |
| `APP_URL` | `https://eropub.com` |
| `DATABASE_URL` | `postgresql://eropub:<secrets/postgres_password>@postgres:5432/eropub?schema=public` |
| `REDIS_URL` | `redis://:<secrets/valkey_password>@valkey:6379/0` |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` – **getrennt offline sichern** |
| `ALLOW_SEARCH_INDEXING` | `false` |
| `ENABLE_TEST_ADAPTERS` | `false` (Pflicht) |
| `S3_ENDPOINT` / `S3_BUCKET` | `http://minio:9000` / `eropub-media` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | eigener App-Benutzer, z. B. `eropub-app` / `openssl rand -hex 32` |
| `LIVEKIT_URL` | `wss://rtc.eropub.com` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | identisch zu `secrets/livekit_keys` |
| `MAIL_MODE` | `smtp` (erst nach Mail-DNS, siehe unten) |
| `TEST_PAYMENT_WEBHOOK_SECRET` | leer lassen |

`TEST_PAYMENT_WEBHOOK_SECRET`, `CCBILL_*` und `IDENTITY_WEBHOOK_SECRET` bleiben leer, bis Verträge
bestehen. Hex-Passwörter vermeiden Sonderzeichen-Probleme in URLs.

Dateirechte prüfen:

```bash
ls -l .env.production secrets/    # erwartet: -rw------- (600), Verzeichnis secrets drwx------
```

**Nie** `.env.production` oder `secrets/` committen (beides steht in `.gitignore`/`.dockerignore`).

## 5. Erster Start

```bash
cd /opt/eropub
export EROPUB_TAG=$(git rev-parse --short HEAD)
DC="docker compose -f docker-compose.prod.yml"

$DC build
$DC up -d postgres valkey minio
$DC --profile tools run --rm minio-init     # Bucket + App-Benutzer
$DC run --rm migrate                        # prisma migrate deploy
$DC run --rm web npm run db:seed            # Stammdaten (nur Erststart; vor Wiederholung Idempotenz prüfen)
$DC up -d                                   # web, worker, caddy, livekit
```

Reihenfolge LiveKit: Caddy muss das Zertifikat für `rtc.eropub.com` bezogen haben, bevor
LiveKit TURN/TLS starten kann. Falls `livekit` anfangs neu startet: `$DC logs caddy` prüfen,
nach erfolgreichem Zertifikat `$DC restart livekit`. Nach jeder Zertifikatserneuerung LiveKit
neu starten (z. B. Cron `0 4 1 * * cd /opt/eropub && docker compose -f docker-compose.prod.yml restart livekit`).

Kontrolle:

```bash
$DC ps
curl -fsS https://eropub.com/api/health
curl -sI https://eropub.com | grep -i -E 'x-robots-tag|strict-transport'
curl -s https://eropub.com/robots.txt        # erwartet: Disallow: /
```

### Admin-Bootstrap

```bash
$DC run --rm -it web npm run admin:bootstrap
```

Interaktiv: legt den ersten Superadmin an und richtet MFA (TOTP) ein. Es gibt **kein**
Standardpasswort. Recovery-Codes offline sichern. Danach weitere Admins nur über das Backend
(Vier-Augen-Freigabe laut Rollenmodell).

### Zahlungs- und Identitätsanbieter

Anbieter werden **ausschließlich im Admin-Backend** aktiviert, und erst nachdem Verträge,
Merchant-Onboarding und die aktuelle Anbieterdokumentation geprüft sind. Env-Variablen
(`CCBILL_*`, `IDENTITY_WEBHOOK_SECRET`) machen einen Adapter nur *konfigurierbar*, nicht aktiv.
Testadapter sind in Produktion technisch gesperrt (`APP_ENV=production`) und zusätzlich über
`ENABLE_TEST_ADAPTERS=false` abgeschaltet.

### Mail

Erst `docs/mail-dns.md` umsetzen (SPF/DKIM/DMARC), dann in `.env.production`:
`MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_SECURE=false` (STARTTLS) bzw.
`465`/`true`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM="eropub.com <info@eropub.com>"`.
Anschließend `$DC up -d web worker`. Testmail über eine Passwort-Zurücksetzen-Anfrage an ein
eigenes Konto; Header (SPF/DKIM/DMARC = pass) beim Empfänger prüfen.

## 6. Betrieb

```bash
DC="docker compose -f docker-compose.prod.yml"
$DC ps                          # Status / Health
$DC logs -f --tail=200 web      # Logs (web, worker, caddy, livekit …)
$DC restart worker
$DC stop                        # alles anhalten (Daten bleiben)
$DC up -d                       # starten
```

> **NIEMALS `docker compose down -v` (oder `docker volume rm`/`docker system prune --volumes`)
> gegen Produktion ausführen.** `-v` löscht die Volumes `pg-data`, `minio-data`, `caddy-data` –
> also Datenbank, Medien und Zertifikate. `down` ohne `-v` ist unkritisch.

## 7. Update

```bash
cd /opt/eropub
DC="docker compose -f docker-compose.prod.yml"
tail -n1 DEPLOYED_TAGS                               # aktuell laufender Tag = Rollback-Ziel

git fetch && git log --oneline HEAD..origin/main     # Änderungen sichten (Migrationen!)
git pull --ff-only
export EROPUB_TAG=$(git rev-parse --short HEAD)

$DC build                                            # neue Images, alte Tags bleiben erhalten
sudo /opt/eropub/scripts/backup.sh --run --skip-media # frisches DB-Backup VOR der Migration
$DC run --rm migrate
$DC up -d                                            # ersetzt web/worker durch neue Images
$DC ps && curl -fsS https://eropub.com/api/health
```

Den verwendeten Tag notieren (z. B. in `/opt/eropub/DEPLOYED_TAGS`), damit ein Rollback-Ziel feststeht:
`echo "$(date -Is) $EROPUB_TAG" >> /opt/eropub/DEPLOYED_TAGS`.

Damit spätere `docker compose`-Aufrufe ohne exportierte Variable denselben Tag verwenden,
auf dem Server zusätzlich `echo "EROPUB_TAG=$EROPUB_TAG" > /opt/eropub/.env` schreiben.
Diese Datei dient dort nur der Compose-Interpolation (die Container lesen `.env.production`;
`.env` ist per `.dockerignore` nicht im Build-Kontext).

Alte Images aufräumen nur gezielt (`docker image rm eropub-web:<alter-tag>`), die letzten 2–3 Tags behalten.

## 8. Rollback

1. **Ohne destruktive Migration** (nur additive Änderungen):
   ```bash
   export EROPUB_TAG=<vorheriger-tag>
   docker compose -f docker-compose.prod.yml up -d --no-build --no-deps web worker
   ```
   `--no-deps` verhindert, dass `migrate` mit dem alten Image erneut läuft. Das Datenbankschema
   bleibt auf dem neueren Stand; das funktioniert nur, wenn die Migration rein additiv war
   (alte Codeversion kennt neue Spalten/Tabellen nicht, stört sich aber nicht daran).
2. **Mit destruktiver Migration** (Spalten/Tabellen entfernt, Daten umgeschrieben):
   Wartungsmodus aktivieren, frisches Backup des aktuellen Zustands ziehen, dann das
   Vor-Update-Backup gemäß `docs/backup-restore.md` wiederherstellen und den vorherigen Tag starten.
   Danach Löschungen erneut anwenden (`docker compose -f docker-compose.prod.yml run --rm worker npm run worker -- --reapply-deletions`, siehe Backup-Doku).

Migrationen deshalb bevorzugt zweistufig (expand → contract) gestalten.

## 9. Objektspeicher (MinIO) – Hinweis zu Images

Das Upstream-Projekt MinIO veröffentlicht seit Ende 2025 keine freien Docker-Hub-Images mehr
(`minio/minio` ist dort nicht mehr verfügbar). Die Compose-Dateien verwenden den Community-Build
`pgsty/minio` / `pgsty/mc` (gepinnte Release-Tags). Vor Produktivbetrieb:

- Herkunft/Signatur des Images bewerten oder selbst aus Quellcode bauen und in eigene Registry pushen;
- alternativ einen anderen S3-kompatiblen Dienst (z. B. Garage, SeaweedFS) oder einen
  EU-Objektspeicher-Anbieter nutzen – die App spricht nur S3-API (`S3_*`).
- Image-Tags aller Dienste vor jedem Update prüfen: `docker manifest inspect <image:tag>`.

## 10. Betrieb unter Plesk (Strato-Server h2923798.stratoserver.net)

Der vorhandene Strato-Server läuft mit **Plesk Obsidian** und der **Plesk-Docker-Erweiterung**.
Plesk belegt 80/443 mit eigenem nginx/Apache – Caddy entfällt dort.

**Immer zuerst Staging:** Domain `eropub.de` als Testinstanz mit gesperrter Indexierung
(`ALLOW_SEARCH_INDEXING=false` → `/robots.txt` Disallow, plus Header `X-Robots-Tag`, siehe unten),
`APP_URL=https://eropub.de`, eigene Secrets, eigene Datenbank. Erst nach erfolgreichem Test
`eropub.com` aufschalten.

### ⚠ Plesk-Server ohne nginx

Ist nginx in Plesk deaktiviert (`plesk sbin nginxmng --status` → `Disabled`), **nginx nicht einschalten**:
Auf dem Produktivserver führte `nginxmng --enable` dazu, dass Apache auf interne Ports umgestellt wurde,
nginx aber nicht startete – alle Domains waren nicht erreichbar. Wiederherstellung:
`plesk sbin nginxmng --disable && plesk sbin httpdmng --reconfigure-all && systemctl restart apache2`.
Stattdessen die Apache-Weiterleitung nur für die eropub-Domain nutzen: `deploy/plesk-apache.conf`.
Nie zusätzliche nginx-Anweisungen mit `client_max_body_size` anlegen (setzt Plesk selbst → „duplicate“).

### Schnellweg (getestet in einer Docker-Testumgebung): `scripts/install-plesk.sh`

Im Plesk-**SSH Terminal** (root):

```bash
apt-get install -y git docker-compose-plugin
git clone -b claude/kind-gauss-d3bemj https://github.com/vigrafo/claude.git /opt/eropub
cd /opt/eropub && bash scripts/install-plesk.sh eropub.com
```

Das Skript erzeugt Secrets und `.env.production` (Testmodus, Suchmaschinen gesperrt), baut die Images,
startet Datenbank/Cache, führt Migrationen und Stammdaten aus und startet Web + Worker auf `127.0.0.1:3000`.
Danach in Plesk: Let's-Encrypt-Zertifikat, Proxy-Modus aus, `deploy/plesk-nginx.conf` als zusätzliche
nginx-Anweisungen; Admin anlegen. Updates: `git pull && bash scripts/install-plesk.sh eropub.com --update`.
Fotos liegen im Docker-Volume `eropub_media`, die Datenbank in `eropub_pg-data` – beide ins Backup aufnehmen.

### Option (a) – empfohlen: Container per SSH + docker compose, Plesk-nginx als Reverse Proxy

1. Per SSH auf den Server, Projekt nach `/opt/eropub` (Schritte 4–5 oben), aber starten mit
   dem Plesk-Override:
   ```bash
   DC="docker compose -f docker-compose.prod.yml -f docker-compose.plesk.yml"
   $DC build && $DC up -d postgres valkey minio
   $DC --profile tools run --rm minio-init && $DC run --rm migrate && $DC up -d
   ```
   `web` lauscht dann nur auf `127.0.0.1:3000`, LiveKit-Signalisierung auf `127.0.0.1:7880`;
   Caddy startet nicht. TURN/TLS (5349) ist in dieser Variante deaktiviert (`deploy/livekit.plesk.yaml`).
2. In Plesk die Domain `eropub.com` (bzw. `eropub.de`) anlegen, **SSL/TLS-Zertifikate → Let's Encrypt**
   inkl. `www` ausstellen, „HTTP → HTTPS umleiten“ aktivieren. Subdomain `rtc.eropub.com` ebenso
   anlegen und mit Let's Encrypt absichern.
3. **Docker → Docker Proxy Rules** (Domain → „Docker Proxy Rules“): Regel `URL /` → Container
   `web`, Port `3000`. Für `rtc.eropub.com`: Regel `/` → Container `livekit`, Port `7880`.
   Werden die Compose-Container in der Plesk-Oberfläche nicht zur Auswahl angeboten, stattdessen
   unter **Apache & nginx Settings → Additional nginx directives** manuell proxen:
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
       # WICHTIG: XFF überschreiben, nicht anhängen – die App wertet die vom Proxy gesetzte Adresse aus
       # (Rate-Limits, CCBill-IP-Allowlist). $proxy_add_x_forwarded_for wäre fälschbar.
       proxy_set_header X-Forwarded-For $remote_addr;
       proxy_set_header X-Real-IP $remote_addr;
       client_max_body_size 26m;
       proxy_read_timeout 3600s;
   }
   ```
   (für `rtc.eropub.com` analog mit `127.0.0.1:7880`). Bei Docker Proxy Rules prüfen, welche
   `X-Forwarded-For`-Behandlung Plesk erzeugt (`/etc/nginx/plesk.conf.d/vhosts/<domain>.conf`)
   und ggf. wie oben überschreiben.
4. Suchmaschinen-Sperre zusätzlich im Webserver: **Apache & nginx Settings → Additional nginx directives**:
   ```nginx
   add_header X-Robots-Tag "noindex, nofollow" always;
   ```
   Weitere Sicherheitsheader dort analog zum Caddyfile setzen (HSTS, nosniff, Referrer-Policy,
   `Permissions-Policy "camera=(self), microphone=(self)"`).
5. **Firewall:** In der Plesk-Firewall (Tools & Settings → Firewall) **und** – falls aktiv – in der
   Strato-Firewall im Kundenbereich freigeben: `7881/tcp`, `50000–50100/udp`, `3478/udp`.
   Ohne diese UDP-Ports funktionieren Audio/Video nicht oder nur eingeschränkt.
   Postgres/Valkey/MinIO bleiben unveröffentlicht; Hinweise zu Docker vs. Firewall: `deploy/ufw-docker.md`.
6. Prüfen, dass Ressourcen reichen: Plesk selbst belegt RAM/CPU; Limits in
   `docker-compose.prod.yml` (`deploy.resources.limits`) ggf. senken.

### Option (b) – nicht empfohlen: Plesk-Git-/Node.js-Erweiterung

Die Plesk-Git-Erweiterung mit Node.js-Hosting (Passenger) baut und betreibt Next.js + Prisma +
PostgreSQL + separaten Worker + LiveKit nicht zuverlässig: kein sauberer Worker-Prozess, keine
reproduzierbaren Builds, Postgres 16/Valkey/LiveKit müssten ohnehin außerhalb laufen,
Migrationen schwer kontrollierbar. Empfehlung: Plesk nur als Webserver/TLS-Frontend nutzen
und die Anwendung per **SSH + docker compose** wie in Option (a) betreiben.
