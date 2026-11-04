# Rollen & Rechte (generiert aus `src/server/rbac.ts`)

Default deny. Gruppen- und Veranstalterrollen wirken nur im jeweiligen Scope und gewähren keinen Adminzugang.

| Recht | Beschreibung | Superadmin | Plattformadmin | Verifizierungsprüfer | Moderation | Support | Finanzen | Redaktion | Veranstalter | Gruppenmoderator |
|---|---|---|---|---|---|---|---|---|---|---|
| `admin.access` | Adminbereich betreten | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `dashboard.view` | Dashboard ansehen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |
| `users.read` | Personen & Profile ansehen | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |  |
| `users.manage` | Personen sperren/entsperren, Paarzuordnung | ✓ | ✓ |  |  |  |  |  |  |  |
| `users.export` | Datenexporte erstellen | ✓ |  |  |  |  |  |  |  |  |
| `verification.review` | Verifizierungen prüfen | ✓ |  | ✓ |  |  |  |  |  |  |
| `verification.evidence` | Temporäre Verifizierungsbelege ansehen |  |  | ✓ |  |  |  |  |  |  |
| `roles.manage` | Rollen vergeben | ✓ |  |  |  |  |  |  |  |  |
| `plans.manage` | Tarife & Preisversionen | ✓ | ✓ |  |  |  |  |  |  |  |
| `tokens.manage` | Tokenpakete & Korrekturen | ✓ | ✓ |  |  |  | ✓ |  |  |  |
| `providers.manage` | Zahlungsanbieter & Secrets | ✓ |  |  |  |  | ✓ |  |  |  |
| `finance.read` | Finanzvorgänge ansehen | ✓ |  |  |  |  | ✓ |  |  |  |
| `finance.manage` | Erstattungen & Abgleich | ✓ |  |  |  |  | ✓ |  |  |  |
| `matching.manage` | Interessen & Matching-Regeln | ✓ | ✓ |  |  |  |  |  |  |  |
| `games.manage` | Spiele & Fragenkatalog | ✓ | ✓ |  |  |  |  |  |  |  |
| `messages.moderate` | Gemeldete Nachrichten (fallbezogen) | ✓ |  |  | ✓ |  |  |  |  |  |
| `calls.manage` | Anrufeinstellungen | ✓ | ✓ |  |  |  |  |  |  |  |
| `media.moderate` | Medienmoderation | ✓ |  |  | ✓ |  |  |  |  |  |
| `groups.manage` | Gruppen freigeben & verwalten | ✓ | ✓ |  |  |  |  |  |  |  |
| `forums.manage` | Foren verwalten | ✓ | ✓ |  | ✓ |  |  | ✓ |  |  |
| `events.manage` | Events, Veranstalter & Clubs | ✓ | ✓ |  |  |  |  |  |  |  |
| `discounts.manage` | Gold-Rabatte | ✓ | ✓ |  |  |  |  |  |  |  |
| `content.manage` | Gold-CMS & öffentliche Seiten | ✓ |  |  |  |  |  | ✓ |  |  |
| `moderation.handle` | Moderationsfälle | ✓ |  |  | ✓ |  |  |  |  |  |
| `moderation.evidence` | Belege gemeldeter Inhalte einsehen |  |  |  | ✓ |  |  |  |  |  |
| `support.handle` | Supporttickets | ✓ |  |  |  | ✓ |  |  |  |  |
| `notifications.manage` | E-Mail & Vorlagen | ✓ | ✓ |  |  |  |  |  |  |  |
| `privacy.manage` | Datenschutz, Löschläufe, Einwilligungen | ✓ | ✓ |  |  |  |  |  |  |  |
| `design.manage` | Design & Kontaktangaben | ✓ | ✓ |  |  |  |  |  |  |  |
| `settings.manage` | Systemeinstellungen & Feature-Flags | ✓ | ✓ |  |  |  |  |  |  |  |
| `ops.view` | Betrieb & Audit | ✓ | ✓ |  |  |  |  |  |  |  |

Kritische Rollen (Vergabe nur mit Vier-Augen-Freigabe): Superadmin, Plattformadmin, Finanzen.

Hinweis: Superadmin und Plattformadmin erhalten bewusst **keinen** Zugriff auf Verifizierungsbelege (`verification.evidence`) oder Belege gemeldeter privater Inhalte (`moderation.evidence`).
