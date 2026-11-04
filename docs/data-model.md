# Datenmodell

Quelle der Wahrheit: `prisma/schema.prisma` (Migrationen unter `prisma/migrations/`).

## Identität und Profile
- `User` = authentifizierte Person (eigener Login, eigenes Passwort, optional TOTP). Getrennt davon: `ageAssuredAt` (durch Anbieter bestätigte Volljährigkeit), `identityStatus` (Badge-Grundlage), `adultConfirmedAt` (Selbstauskunft).
- `CommunityProfile` = sichtbares Einzel-, Paar- oder Veranstalterprofil (Pseudonym `handle`, grobe Region, Tokenkonto).
- `ProfileMembership` = berechtigte Zuordnung `User ↔ Profile` (`@@unique(profileId,userId)`); Paar = genau zwei aktive Mitgliedschaften, `displayLabel` als sichtbare Absenderkennung.
- `CoupleInvite` (gehashter Token, Ablauf), `VerificationCase` (minimiert, `@@unique(provider, providerRef)`), `ConsentRecord`.

## Kontakte und Kommunikation
`ContactRequest`, `Connection` (geordnetes Paar `aId < bId`, eindeutig), `Block` (eindeutig), `Favorite`, `ProfileLike`, `Conversation` (`pairKey` eindeutig), `ConversationParticipant`, `MessageRequest` (eine je Konversation), `Message` (`@@unique(senderProfileId, clientKey)` → Idempotenz), `GiftType`, `MediaAsset`, `CallSession`.

## Tarife und Geld (Cent + Währung)
`PlanVersion` (`@@unique(plan, version)`), `PremiumClock` (1 je Person, unveränderlich), `Subscription` (`@@unique(provider, providerSubId)`), `Entitlement`, `TokenPackageVersion`, `TokenLedgerEntry` (`idemKey` eindeutig, `balanceAfter`), `TokenDebt`, `Order` (`idemKey`, `@@unique(provider, providerRef)`), `Payment` (`@@unique(provider, providerTxId)`), `Refund`, `Invoice` (1 je Order), `ProviderConfiguration`, `WebhookEvent` (`@@unique(provider, eventId)`).

## Community
`Group` (Status draft…archived), `GroupMembership` (`canWrite` getrennt), `GroupApplication`, `GroupModeratorApplication` (`openKey` eindeutig solange offen), `ForumCategory`, `Thread`, `ThreadSubscription`, `Post`, `PostRevision`.

## Events, Clubs, Rabatte, Dates
`Organizer`, `Club` (Sterne nur durch eropub), `Event`, `TicketType`, `TicketOrder`, `DiscountRule`, `DiscountRedemption` (`ticketOrderId` eindeutig, `activeKey` eindeutig solange aktiv), `DateOffer`.

## Kennenlernspiele
`GameQuestionVersion` (`@@unique(questionKey, version)`), `GameOption`, `GameRuleVersion`, `GameSession` (Regel- und Fragen-Snapshot), `GameParticipant` (`@@unique(sessionId, profileId)`), `GamePersonConsent` (`@@unique(participantId, userId, kind)`, `answersHash`), `GameAnswer` (`@@unique(sessionId, participantId, questionKey)`), `GameSubmission` (1 je Teilnehmer, gesperrte Antworten), `GameMatch` (1 je Session).

## Betrieb
`GoldContent` + `GoldContentRevision` + `GoldBookmark`, `PublicPage`, `Report`, `ModerationCase`, `ModerationAction`, `SupportTicket`, `SupportReply`, `Notification`, `OutboxEvent`, `EmailLog` (Empfänger gehasht), `SettingVersion` (`@@unique(key, version)`), `AuditEvent` (Hashkette, `seq`), `DeletionRequest`, `DeletionTombstone`, `Country`, `Region`, `RateLimitHit`, `Role`, `Permission`, `RolePermission`, `RoleAssignment` (Scope für Gruppen-/Eventrollen), `PendingApproval` (Vier-Augen).

## Zustandswechsel
Siehe `docs/tariffs.md` (Abo), `docs/verification.md` (Verifizierung), `src/server/games.ts` (Spiel: invited → accepted/answering → completed | declined | expired | cancelled, Teilnehmer: invited → accepted → answering → submitted | declined).
