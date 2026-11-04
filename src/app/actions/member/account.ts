"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile, actingUser, enabledPaymentProvider } from "@/app/app/_lib/server";
import { cancelOwnSubscription, startSubscriptionCheckout } from "@/server/subscriptions";
import { createTokenOrder } from "@/server/payments/service";
import { markRead } from "@/server/notifications";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { can } from "@/domain/access";

async function provider() {
  const p = await enabledPaymentProvider();
  if (!p) throw new AppError("provider", "Derzeit ist keine Zahlungsart verfügbar. Bitte versuche es später erneut.", 503);
  return p.key;
}

export async function startPlanCheckoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    const plan = str(fd, "plan");
    if (plan !== "premium" && plan !== "gold") throw new AppError("plan", "Bitte wähle Premium oder Gold.");
    const { redirectUrl } = await startSubscriptionCheckout(userId, plan, await provider());
    redirect(redirectUrl);
  });
}

export async function cancelSubscriptionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    await cancelOwnSubscription(userId, str(fd, "subscriptionId"));
    revalidatePath("/app/konto");
    return { ok: true, message: "Gekündigt. Deine Vorteile bleiben bis zum Ende des bezahlten Zeitraums erhalten." };
  });
}

export async function buyTokensAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const { redirectUrl } = await createTokenOrder(userId, profileId, str(fd, "packageKey"), await provider());
    redirect(redirectUrl);
  });
}

export async function markNotificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    const id = str(fd, "id");
    const n = await markRead(userId, id || undefined);
    revalidatePath("/app", "layout");
    return { ok: true, message: id ? "Als gelesen markiert." : `${n} als gelesen markiert.` };
  });
}

/** Gold-Lesezeichen – Rechte serverseitig (Gold + vollständig verifiziert). */
export async function toggleGoldBookmarkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { profileId, v } = await actingProfile();
    const c = can("gold_content", v.person, v.profile);
    if (!c.allowed) throw new AppError("forbidden", c.reason ?? "Gold-Funktion.", 403);
    const content = await db.goldContent.findFirst({ where: { id: str(fd, "contentId"), status: "published", publishAt: { lte: new Date() } } });
    if (!content) throw new AppError("not_found", "Inhalt nicht gefunden.", 404);
    const key = { profileId_contentId: { profileId, contentId: content.id } };
    const existing = await db.goldBookmark.findUnique({ where: key });
    if (existing) await db.goldBookmark.delete({ where: key });
    else await db.goldBookmark.create({ data: { profileId, contentId: content.id } });
    revalidatePath("/app/gold", "layout");
    return { ok: true, message: existing ? "Lesezeichen entfernt." : "Gemerkt." };
  });
}
