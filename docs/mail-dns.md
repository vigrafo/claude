# Mail-DNS für eropub.com (SPF, DKIM, DMARC)

Postfächer/Adressen (Schreibweise bewusst so, **nicht korrigieren**):

| Adresse | Zweck |
|---------|-------|
| `verwaltung@eropub.com` | Verwaltung/Admin, Alarme, ACME-Kontakt, DMARC-Berichte |
| `contakt@eropub.com` | Kontaktformular/Support (Schreibweise „contakt“ ist beabsichtigt) |
| `info@eropub.com` | Absender transaktionaler Mails (`MAIL_FROM`), allgemeine Info |

Die Adressen sind zusätzlich im Backend unter der Einstellung `contact.addresses` hinterlegt.

## Grundsatz

Die App versendet über SMTP (`MAIL_MODE=smtp`, `SMTP_*`). Empfohlen ist ein **etablierter
Mail-Anbieter bzw. das Postfach-Hosting (z. B. Strato/Plesk-Mailserver)** statt eines eigenen
MTA im Docker-Stack. Wichtig: Alle tatsächlich versendenden Systeme müssen in SPF enthalten
sein und DKIM-signieren, sonst greift DMARC.

Werte unten sind **Beispiele**; die genauen `include:`-Angaben und DKIM-Schlüssel liefert der
jeweilige Anbieter. `203.0.113.20` / `2001:db8::20` sind Platzhalter für die Server-IPs.

## MX

```dns
eropub.com.            3600  IN  MX   10 mx.<mail-anbieter>.     ; laut Anbieter
```

Bei Mailserver unter Plesk auf dem eigenen Server:

```dns
eropub.com.            3600  IN  MX   10 mail.eropub.com.
mail.eropub.com.       3600  IN  A    203.0.113.20
```

+ PTR/Reverse-DNS der Server-IP auf `mail.eropub.com` (bei Strato im Kundenbereich).

## SPF

Nur **ein** SPF-Record je Name. Beispiele:

```dns
; a) Versand ausschließlich über externen Anbieter
eropub.com.  3600  IN  TXT  "v=spf1 include:<spf-domain-des-anbieters> -all"

; b) Versand über Plesk-Mailserver auf dem eigenen Server
eropub.com.  3600  IN  TXT  "v=spf1 mx ip4:203.0.113.20 ip6:2001:db8::20 -all"
```

Zum Start ggf. `~all` (softfail) statt `-all`, bis alle Absender erfasst sind; danach `-all`.
Maximal 10 DNS-Lookups (`include`, `a`, `mx` …) beachten.

## DKIM

Schlüssel beim Anbieter bzw. in Plesk erzeugen (Plesk: *Mail → Mail-Einstellungen → DKIM*
aktivieren; Plesk legt bei Plesk-DNS den Record selbst an, bei externem DNS manuell übertragen).
Mindestens 2048 Bit RSA.

```dns
<selector>._domainkey.eropub.com.  3600  IN  TXT  ( "v=DKIM1; k=rsa; "
    "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...<öffentlicher Schlüssel vom Anbieter>..." )
```

Selector-Beispiele: `default` (Plesk), `s1`/`s2` (viele Anbieter). Bei Schlüsselwechsel
neuen Selector parallel veröffentlichen, umstellen, alten nach einigen Tagen entfernen.

## DMARC

Stufenweise verschärfen:

```dns
; Phase 1 (2–4 Wochen): nur beobachten
_dmarc.eropub.com.  3600  IN  TXT  "v=DMARC1; p=none; rua=mailto:verwaltung@eropub.com; adkim=s; aspf=s; fo=1"

; Phase 2: Quarantäne für einen Teil
_dmarc.eropub.com.  3600  IN  TXT  "v=DMARC1; p=quarantine; pct=25; rua=mailto:verwaltung@eropub.com; adkim=s; aspf=s"

; Phase 3 (Ziel): ablehnen
_dmarc.eropub.com.  3600  IN  TXT  "v=DMARC1; p=reject; rua=mailto:verwaltung@eropub.com; adkim=s; aspf=s"
```

`adkim=s; aspf=s` (strikt) setzt voraus, dass Envelope-From/DKIM-Domain exakt `eropub.com`
sind. Nutzt der Anbieter eine Subdomain (z. B. `bounce.eropub.com`), stattdessen relaxed (`r`).
DMARC-Berichte (`rua`) können umfangreich sein – ggf. eigenes Postfach oder Auswertungsdienst.

## Weitere Domains (nicht versendend)

Für `eropub.de` (Staging) und weitere Domains ohne Mailversand Missbrauch unterbinden:

```dns
eropub.de.          3600  IN  TXT  "v=spf1 -all"
_dmarc.eropub.de.   3600  IN  TXT  "v=DMARC1; p=reject; adkim=s; aspf=s"
*._domainkey.eropub.de. 3600 IN TXT "v=DKIM1; p="
```

(Falls Staging Testmails versendet: dort `MAIL_MODE=log` bevorzugen oder eigenen SPF/DKIM einrichten.)

## Optional

- **MTA-STS / TLS-RPT** für eingehende Mails, sobald der Mailbetrieb stabil ist.
- **BIMI** erst nach `p=quarantine`/`reject` sinnvoll.

## Prüfen

```bash
dig +short TXT eropub.com
dig +short TXT _dmarc.eropub.com
dig +short TXT <selector>._domainkey.eropub.com
dig +short MX eropub.com
```

Danach eine Testmail (z. B. Passwort-Reset an ein eigenes externes Postfach) senden und im
Header prüfen: `spf=pass`, `dkim=pass`, `dmarc=pass`. Erst dann `MAIL_MODE=smtp` dauerhaft
aktivieren.
