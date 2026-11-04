# Docker, UFW und veröffentlichte Ports

## Problem

Docker schreibt eigene iptables-/nftables-Regeln (Ketten `DOCKER`, `DOCKER-USER`, NAT `PREROUTING`).
Ein mit `ports:` veröffentlichter Container-Port wird per DNAT **vor** den UFW-Regeln
(`ufw-user-input`) behandelt. Folge: `ufw deny 5432` schützt einen veröffentlichten
Postgres-Port **nicht**. UFW allein ist für Docker-Ports keine wirksame Firewall.

## Gewählter Ansatz

1. **Nur das Nötigste veröffentlichen** (`docker-compose.prod.yml`):

   | Dienst  | Host-Port                        | Zweck                         |
   |---------|----------------------------------|-------------------------------|
   | caddy   | 80/tcp, 443/tcp, 443/udp         | HTTP→HTTPS, HTTPS, HTTP/3     |
   | livekit | 7881/tcp                         | ICE über TCP (Fallback)       |
   | livekit | 50000–50100/udp                  | WebRTC-Medien                 |
   | livekit | 3478/udp                         | TURN/UDP                      |
   | livekit | 5349/tcp                         | TURN/TLS                      |

   Postgres, Valkey, MinIO, web und worker haben **keine** `ports:`. Sie sind nur im
   Compose-Netz `backend` (`internal: true`, ohne Internetzugang) erreichbar.

2. **UFW für den Host selbst** (SSH und alles, was nicht Docker ist):

   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw limit 22/tcp            # bzw. eigener SSH-Port
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 443/udp
   sudo ufw allow 7881/tcp
   sudo ufw allow 50000:50100/udp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw enable
   ```

   Die Docker-Ports sind damit dokumentiert; wirksam ist für sie aber Punkt 1 bzw. 3.

3. **Optional: Zusatzfilter in der Kette `DOCKER-USER`.** Docker lässt diese Kette unangetastet;
   sie wird für weitergeleiteten Verkehr zu Containern vor Dockers eigenen Regeln ausgewertet.
   Beispiel (iptables-Backend; Interface `eth0` anpassen): eingehend aus dem Internet nur die
   oben gelisteten Container-Ports zulassen, alles andere verwerfen.

   ```bash
   # /etc/ufw/after.rules – am ENDE der Datei anhängen (eigener *filter-Block)
   *filter
   :DOCKER-USER - [0:0]
   # Antworten auf bestehende Verbindungen immer erlauben
   -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
   # Verkehr, der nicht von außen (eth0) kommt, nicht anfassen (Container↔Container, ausgehend)
   -A DOCKER-USER ! -i eth0 -j RETURN
   # Erlaubte Ziele (Ports NACH DNAT = Container-Ports; hier identisch zu den Host-Ports)
   -A DOCKER-USER -p tcp -m multiport --dports 80,443,7881,5349 -j RETURN
   -A DOCKER-USER -p udp -m multiport --dports 443,3478 -j RETURN
   -A DOCKER-USER -p udp --dport 50000:50100 -j RETURN
   # Alles andere von außen zu Containern verwerfen
   -A DOCKER-USER -i eth0 -j DROP
   COMMIT
   ```

   ```bash
   sudo ufw reload
   sudo iptables -L DOCKER-USER -n -v     # Kontrolle
   ```

   Hinweise:
   - Für IPv6 analog in `/etc/ufw/after6.rules` mit `ip6tables`-Semantik (Docker ≥ 27 aktiviert
     IPv6-Regeln nur, wenn IPv6 im Daemon konfiguriert ist).
   - Nach Docker-Updates prüfen, ob die Kette noch eingehängt ist (`iptables -L FORWARD -n`).
   - Fehler hier können den gesamten Container-Verkehr blockieren: per Konsole (nicht nur SSH)
     testen, Rollback-Weg bereithalten.

4. **Kontrolle von außen** (von einem anderen Rechner):

   ```bash
   nmap -Pn -p 22,80,443,3000,5432,6379,7880,9000,9001 eropub.com
   nmap -Pn -sU -p 3478,50000 eropub.com
   ```

   Erwartet: offen nur 22 (bzw. SSH-Port), 80, 443; 3000/5432/6379/7880/9000/9001 geschlossen/gefiltert.

## Unter Plesk

Plesk bringt eine eigene Firewall-Erweiterung (iptables). Für Docker-Ports gilt dasselbe:
veröffentlichte Ports umgehen sie teilweise. Deshalb dort Container-Ports nur an
`127.0.0.1` binden (z. B. `127.0.0.1:3000:3000`) und ausschließlich die LiveKit-Ports
öffentlich veröffentlichen + in der Plesk-Firewall **und** ggf. in der Strato-Cloud-Firewall
freigeben. Details: `docs/ubuntu-deployment.md`, Abschnitt Plesk.
