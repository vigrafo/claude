import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { readConversation } from "@/server/messaging";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { areConnected, isBlockedEitherWay } from "@/server/state";
import { getSetting } from "@/server/settings";
import { Avatar, VerifiedBadge, formatDate } from "@/components/ui";
import { HiddenForm, ReportForm } from "@/app/app/_components/forms";
import { MessageComposer } from "@/app/app/_components/MessageComposer";
import { respondMessageRequestAction, sendMessageAction } from "@/app/actions/member/messages";
import { blockAction } from "@/app/actions/member/contacts";

export const metadata: Metadata = { title: "Unterhaltung" };

export default async function Unterhaltung({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profileId, v } = await actingProfile();
  let messages;
  try {
    messages = await readConversation(userId, profileId, id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const conv = await db.conversation.findUniqueOrThrow({
    where: { id }, include: { request: true, participants: { include: { profile: { select: { id: true, handle: true, type: true, verifiedBadge: true, status: true } } } } },
  });
  const other = conv.participants.find((p) => p.profileId !== profileId)?.profile;
  if (!other) notFound();
  const [blocked, connected, gifts, features] = await Promise.all([
    isBlockedEitherWay(profileId, other.id), areConnected(profileId, other.id),
    db.giftType.findMany({ where: { active: true }, orderBy: { sort: "asc" } }), getSetting("features"),
  ]);
  const giftById = new Map(gifts.map((g) => [g.id, g]));
  const senderType = new Map(conv.participants.map((p) => [p.profileId, p.profile.type]));
  const req = conv.request;
  const iAmRequester = req?.fromProfileId === profileId;
  const pendingToMe = req?.status === "pending" && req.toProfileId === profileId;
  const waiting = !connected && req?.status === "pending" && iAmRequester;
  const declined = !connected && req?.status === "declined";
  const send = v.can("send_message");
  const canWrite = !blocked && other.status === "active" && send.allowed && !waiting && !declined;

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row between">
        <div className="row">
          <Link className="btn ghost small" href="/app/nachrichten" aria-label="Zurück zu den Nachrichten">←</Link>
          <Avatar name={other.handle} />
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: 0 }}><Link href={`/app/profil/${encodeURIComponent(other.handle)}`}>{other.handle}</Link></h1>
            <VerifiedBadge verified={other.verifiedBadge} />
          </div>
        </div>
        {!blocked && (
          <div className="row">
            <HiddenForm action={blockAction} fields={{ targetId: other.id }} submit="Blockieren" submitClass="btn danger small" confirm={`${other.handle} wirklich blockieren?`} />
            <ReportForm targetType="profile" targetId={other.id} label="Profil melden" />
          </div>
        )}
      </div>

      {pendingToMe && (
        <div className="alert info row between" style={{ margin: 0 }}>
          <span>Nachrichtenanfrage: Möchtest du mit {other.handle} schreiben? Eine Antwort gilt ebenfalls als Annahme.</span>
          <span className="row">
            <HiddenForm action={respondMessageRequestAction} fields={{ conversationId: id, accept: "1" }} submit="Annehmen" submitClass="btn small" />
            <HiddenForm action={respondMessageRequestAction} fields={{ conversationId: id, accept: "0" }} submit="Ablehnen" />
          </span>
        </div>
      )}

      <section className="chat card" aria-label="Nachrichtenverlauf" aria-live="polite">
        {messages.length === 0 && <p className="muted">Noch keine Nachrichten.</p>}
        {messages.map((m) => {
          const mine = m.senderProfileId === profileId;
          const gift = m.giftId ? giftById.get(m.giftId) : null;
          return (
            <div key={m.id} className={`msg ${mine ? "mine" : ""}`}>
              {m.kind === "gift" && <div style={{ fontSize: "1.6rem" }} aria-label={`Geschenk: ${gift?.label ?? "Geschenk"}`}>{gift?.emoji ?? "🎁"} <span style={{ fontSize: "0.9rem" }}>{gift?.label ?? "Geschenk"}</span></div>}
              {m.body && <div>{m.body}</div>}
              <div className="meta">
                {formatDate(m.createdAt, true)}
                {senderType.get(m.senderProfileId) === "couple" && m.senderLabel ? ` · gesendet von ${m.senderLabel}` : ""}
                {mine && m.tokenCost > 0 ? ` · ${m.tokenCost} ${m.tokenCost === 1 ? "Token" : "Tokens"}` : ""}
              </div>
              {!mine && <ReportForm targetType="message" targetId={m.id} label="Nachricht melden" />}
            </div>
          );
        })}
      </section>

      {blocked ? (
        <p className="alert warn">Kontakt nicht möglich. Blockierungen verwaltest du unter <Link href="/app/profil/datenschutz">Datenschutz</Link>.</p>
      ) : waiting ? (
        <p className="alert info">Deine Nachrichtenanfrage wartet auf Annahme. Weitere Nachrichten sind erst danach möglich.</p>
      ) : declined ? (
        <p className="alert info">Diese Unterhaltung ist geschlossen.</p>
      ) : !send.allowed ? (
        <p className="alert warn">{send.reason}</p>
      ) : canWrite ? (
        <MessageComposer
          action={sendMessageAction} hidden={{ conversationId: id }} costPerMessage={send.tokenCostPerMessage ?? 1} balance={v.profileRow.tokenBalance}
          gifts={features.giftsEnabled ? gifts.map((g) => ({ key: g.key, label: g.label, emoji: g.emoji, tokenCost: g.tokenCost })) : []}
        />
      ) : null}
    </div>
  );
}
