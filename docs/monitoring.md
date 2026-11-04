# Monitoring und Alarmierung

Ziel: Ausfälle und Rückstaus früh erkennen, ohne personenbezogene Inhalte in Monitoring-
Systeme zu tragen. Leichtgewichtig, für einen Einzelserver.

## Health-Endpunkt

`GET https://eropub.com/api/health` – liefert HTTP 200, wenn die App läuft und ihre
Abhängigkeiten (DB, Redis) erreichbar sind; sonst 503. Wird genutzt von:
Docker-Healthcheck (`web`), Caddy (`health_uri`) und externem Uptime-Monitor.
Der Endpunkt darf keine Interna (Versionen, Hostnamen, Fehlermeldungen mit Pfaden) ausgeben.

## Was überwacht wird

| Bereich | Signal | Schwelle (Vorschlag) | Quelle |
|---------|--------|----------------------|--------|
| Erreichbarkeit | `/api/health`, `https://rtc.eropub.com` (TLS/Handshake) | 2 Fehlversuche in Folge | Uptime Kuma (HTTP) |
| Container | Status/Health aller Dienste, Neustart-Schleifen | `unhealthy` > 2 min, > 3 Restarts/h | `docker compose ps`, cAdvisor |
| Outbox-Rückstau | `OutboxEvent` mit `status='pending'` und `availableAt` < now − 5 min | > 100 bzw. ältester > 15 min | SQL (unten) |
| Outbox-Fehler | `OutboxEvent` mit `status='failed'` | > 0 neu in 1 h | SQL |
| Webhooks | `WebhookEvent` mit `status IN ('rejected','failed')` bzw. `signatureOk=false` | > 0 in 1 h (Anstieg ⇒ Angriff oder Konfigurationsfehler) | SQL |
| Löschjobs | `DeletionRequest` mit `status='failed'` oder `scheduledFor` überschritten > 24 h | > 0 | SQL |
| Backups | Push-Ping von `scripts/backup.sh` | kein Erfolg > 26 h, jeder `/fail` | Uptime Kuma (Push) |
| Host | CPU, RAM, Swap, Load | CPU > 85 % 15 min, RAM > 90 %, Swap aktiv | node-exporter |
| Plattenplatz | `/`, `/var/lib/docker`, Backup-Staging | > 80 % Warnung, > 90 % kritisch | node-exporter |
| Zertifikate | Ablauf eropub.com, www, rtc | < 20 Tage | Uptime Kuma (TLS-Expiry) |
| Objektspeicher | Belegung des Buckets, Wachstum/Tag | > 80 % des Volumes | `mc du` / Plattenplatz |
| LiveKit | Teilnehmer, Bandbreite, Paketverlust | Bandbreite > Budget (`calls.limits.monthlyBudgetCents`, docs/cost-model.md) | LiveKit-Prometheus-Endpunkt (optional) |
| Mail | `EmailLog.status='failed'` | > 5 in 1 h | SQL |

### SQL-Abfragen (read-only)

Per Cron oder als Uptime-Kuma-„Push“-Skript auf dem Host ausführen. Ausgabe nur Zahlen.

```bash
DC="docker compose -f /opt/eropub/docker-compose.prod.yml"
q() { $DC exec -T postgres psql -U eropub -d eropub -At -c "$1"; }

q "SELECT count(*) FROM \"OutboxEvent\" WHERE status='pending' AND \"availableAt\" < now() - interval '5 minutes'"
q "SELECT coalesce(extract(epoch FROM now() - min(\"availableAt\"))::int, 0) FROM \"OutboxEvent\" WHERE status='pending'"
q "SELECT count(*) FROM \"OutboxEvent\" WHERE status='failed' AND \"createdAt\" > now() - interval '1 hour'"
q "SELECT count(*) FROM \"WebhookEvent\" WHERE (status IN ('rejected','failed') OR \"signatureOk\" = false) AND \"receivedAt\" > now() - interval '1 hour'"
q "SELECT count(*) FROM \"DeletionRequest\" WHERE status='failed' OR (status IN ('requested','scheduled') AND \"scheduledFor\" < now() - interval '24 hours')"
q "SELECT count(*) FROM \"EmailLog\" WHERE status='failed' AND \"createdAt\" > now() - interval '1 hour'"
```

(Tabellen-/Spaltennamen gemäß `prisma/schema.prisma`, Stand Erstmigration; bei Schemaänderungen anpassen.)

Empfehlung: einen schreibgeschützten DB-Benutzer `monitor` mit `GRANT SELECT` nur auf diese
Tabellen anlegen, statt den App-Benutzer zu verwenden.

## Vorgeschlagener Stack

**Minimal (Start):**

- **Uptime Kuma** – idealerweise auf einem *anderen* Server/kleinen VPS (sonst fällt das
  Monitoring mit dem Server aus). Monitore: HTTP `/api/health`, TLS-Ablauf (3 Hostnamen),
  Push für Backup und für das SQL-Prüfskript, TCP 7881 / UDP-Erreichbarkeit grob über
  einen Testanruf im Staging.
- Benachrichtigung per E-Mail an verwaltung@eropub.com und zusätzlich einen zweiten Kanal
  (z. B. Messenger/Push), damit Mail-Ausfälle nicht unbemerkt bleiben.

**Optional (ab ca. 10k Mitglieder):**

- `prom/node-exporter` + `gcr.io/cadvisor/cadvisor` + Prometheus + Grafana bzw. VictoriaMetrics,
  alle nur im internen Netz bzw. an `127.0.0.1` gebunden; Zugriff per SSH-Tunnel oder VPN,
  niemals öffentlich.
- LiveKit-Metriken: `prometheus_port` in `deploy/livekit.yaml` setzen (nur intern erreichbar).

Images bei Einführung mit festem Tag pinnen (wie in `docker-compose.prod.yml`).

## Logs und Redaktion

Grundsatz: Logs dienen Betrieb und Sicherheit, nicht der Inhaltsanalyse.

**Nie loggen:**

- Nachrichteninhalte, Profiltexte, Bilder/Dateinamen von Uploads, Spiel-Antworten.
- Ausweis-/Verifizierungsdaten, Geburtsdaten, Selfie-/Dokumentreferenzen der Anbieter im Klartext.
- Passwörter, Session-Cookies, `Authorization`-Header, MFA-Codes, Recovery-Codes,
  Token in URLs (`token`, `code`), Webhook-Rohkörper von Zahlungs-/Identitätsanbietern.
- Vollständige E-Mail-Adressen (die App protokolliert nur Hashes, siehe `EmailLog.toHash`).
- Zahlungsdaten (die App erhält ohnehin keine Kartendaten; Anbieter-Referenzen nur gekürzt).

**Umsetzung:**

- Caddy-Zugriffslog: Cookie/Authorization-Header und `token`/`code`-Query-Parameter werden
  gefiltert (`deploy/Caddyfile`). IP-Adressen erscheinen dort; Aufbewahrung begrenzen.
- Docker-Logs: Rotation 5×20 MB je Dienst ⇒ effektiv wenige Tage. Werden Logs an ein
  zentrales System geschickt: Aufbewahrung ≤ 14 Tage, Zugriff nur Betrieb, im
  Verarbeitungsverzeichnis dokumentieren.
- Fehler-Stacktraces ohne Request-Bodies; Nutzer nur als interne ID.
- Audit-Ereignisse (`AuditEvent`) sind kein Log, sondern Fachdaten mit eigener Aufbewahrungsregel.
