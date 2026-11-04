"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { respondToRequest, sendMessage } from "@/server/messaging";
import { db } from "@/server/db";
import { AppError, forbidden, notFound } from "@/server/errors";
import { rateLimit } from "@/server/ratelimit";
import { getSetting } from "@/server/settings";

/**
 * Empfänger wird serverseitig bestimmt: aus der Konversation (Teilnahmeprüfung) oder über das Pseudonym.
 */
export async function sendMessageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const lim = await getSetting("ratelimits");
    await rateLimit("msg", `${userId}:${profileId}`, lim.messagesPerMinute, 60);
    let toProfileId: string;
    const conversationId = str(fd, "conversationId");
    if (conversationId) {
      const parts = await db.conversationParticipant.findMany({ where: { conversationId } });
      if (!parts.some((p) => p.profileId === profileId)) throw forbidden();
      const other = parts.find((p) => p.profileId !== profileId);
      if (!other) throw notFound();
      toProfileId = other.profileId;
    } else {
      const to = await db.communityProfile.findUnique({ where: { handle: str(fd, "to") } });
      if (!to) throw notFound("Profil nicht gefunden.");
      toProfileId = to.id;
    }
    const kind = str(fd, "kind") === "gift" ? "gift" : "text";
    if (kind === "gift" && !(await getSetting("features")).giftsEnabled) throw new AppError("gifts", "Geschenke sind derzeit deaktiviert.");
    const body = typeof fd.get("body") === "string" ? (fd.get("body") as string) : "";
    const r = await sendMessage({
      actorUserId: userId, fromProfileId: profileId, toProfileId, body, clientKey: str(fd, "clientKey"), kind,
      giftKey: kind === "gift" ? str(fd, "giftKey") : undefined,
    });
    revalidatePath(`/app/nachrichten/${r.conversationId}`);
    if (!conversationId) redirect(`/app/nachrichten/${r.conversationId}`);
    const cost = r.tokenCost > 0 ? ` (${r.tokenCost} ${r.tokenCost === 1 ? "Token" : "Tokens"}, Guthaben ${r.balance})` : "";
    return { ok: true, message: r.duplicate ? "Bereits gesendet." : `Gesendet${cost}.` };
  });
}

export async function respondMessageRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const accept = str(fd, "accept") === "1";
    await respondToRequest(userId, profileId, str(fd, "conversationId"), accept);
    revalidatePath("/app", "layout");
    return { ok: true, message: accept ? "Anfrage angenommen – ihr könnt jetzt schreiben." : "Anfrage abgelehnt." };
  });
}
