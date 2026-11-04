"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { int, run, str, type ActionState } from "@/lib/actions";
import { actingProfile, enabledPaymentProvider } from "@/app/app/_lib/server";
import { cancelTicketOrder, reserveTicket } from "@/server/events";
import { createOrder } from "@/server/payments/service";
import { db } from "@/server/db";
import { AppError, forbidden } from "@/server/errors";

export async function reserveTicketAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const qty = int(fd, "quantity");
    const r = await reserveTicket(userId, profileId, str(fd, "ticketTypeId"), Number.isFinite(qty) ? qty : 1);
    redirect(`/app/events/${r.order.eventId}?bestellung=${r.order.id}`);
  });
}

export async function payTicketAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const o = await db.ticketOrder.findUnique({ where: { id: str(fd, "ticketOrderId") }, include: { event: true } });
    if (!o || o.userId !== userId || o.profileId !== profileId) throw forbidden();
    if (o.event.providerPaymentUrl) throw new AppError("provider", "Für dieses Event zahlst du direkt beim Anbieter.");
    if (o.status !== "reserved" || !o.reservedUntil || o.reservedUntil < new Date()) throw new AppError("expired", "Die Reservierung ist nicht mehr gültig. Bitte reserviere neu.");
    const open = await db.order.findFirst({ where: { kind: "ticket", refKey: o.id, status: { in: ["pending", "paid"] } } });
    if (open?.status === "paid") throw new AppError("paid", "Dieses Ticket ist bereits bezahlt.");
    const provider = await enabledPaymentProvider();
    if (!provider) throw new AppError("provider", "Derzeit ist keine Zahlungsart verfügbar. Bitte versuche es später erneut.", 503);
    const { redirectUrl } = await createOrder({
      userId, profileId, kind: "ticket", refKey: o.id, amountCents: o.payableCents, currency: "EUR", provider: provider.key, description: "eropub Ticket",
    });
    redirect(redirectUrl);
  });
}

export async function cancelTicketAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingProfile();
    await cancelTicketOrder(userId, str(fd, "ticketOrderId"));
    revalidatePath("/app/events", "layout");
    return { ok: true, message: "Reservierung storniert." };
  });
}
