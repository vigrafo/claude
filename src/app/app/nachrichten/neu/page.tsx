import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { actingProfile } from "@/app/app/_lib/server";
import { getProfileForViewer } from "@/server/discover";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { MessageComposer } from "@/app/app/_components/MessageComposer";
import { sendMessageAction } from "@/app/actions/member/messages";

export const metadata: Metadata = { title: "Neue Nachricht" };

export default async function NeueNachricht({ searchParams }: { searchParams: Promise<{ an?: string }> }) {
  const { an } = await searchParams;
  if (!an) redirect("/app/nachrichten");
  const { userId, profileId, v } = await actingProfile();
  let p;
  try {
    p = await getProfileForViewer(userId, profileId, an);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  if (p.isSelf) redirect("/app/nachrichten");
  if (p.conversationId) redirect(`/app/nachrichten/${p.conversationId}`);
  const send = v.can("send_message");
  const [gifts, features] = await Promise.all([db.giftType.findMany({ where: { active: true }, orderBy: { sort: "asc" } }), getSetting("features")]);
  const cost = send.tokenCostPerMessage ?? 1;
  const note = p.connected
    ? undefined
    : `Ihr seid noch nicht verbunden: Diese erste Nachricht wird als Nachrichtenanfrage zugestellt. Weitere Nachrichten sind erst möglich, wenn ${p.handle} annimmt oder antwortet.${cost ? ` Mit Basis kostet sie ${cost} Token – auch wenn sie abgelehnt wird.` : ""}`;
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row">
        <Link className="btn ghost small" href="/app/nachrichten" aria-label="Zurück zu den Nachrichten">←</Link>
        <Avatar name={p.handle} />
        <div>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Nachricht an {p.handle}</h1>
          <VerifiedBadge verified={p.verified} />
        </div>
      </div>
      {!send.allowed ? (
        <p className="alert warn">{send.reason}</p>
      ) : (
        <MessageComposer
          action={sendMessageAction} hidden={{ to: p.handle }} costPerMessage={cost} balance={v.profileRow.tokenBalance} requestNote={note}
          gifts={features.giftsEnabled ? gifts.map((g) => ({ key: g.key, label: g.label, emoji: g.emoji, tokenCost: g.tokenCost })) : []}
        />
      )}
    </div>
  );
}
