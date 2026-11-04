"use server";
import { bool, int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { confirmProviderPayment, decideEvent, rateClub } from "@/server/events";
import { decideClub, decideOrganizer, setOrganizerPartner } from "@/server/admin/events";

type Decision = "approved" | "rejected" | "suspended";
function decision(fd: FormData): Decision {
  const s = str(fd, "status");
  if (!["approved", "rejected", "suspended"].includes(s)) throw new AppError("status", "Ungültiger Status.");
  return s as Decision;
}

export async function organizerDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => { await decideOrganizer(a.user.id, str(fd, "id"), decision(fd), str(fd, "reason")); });
}

export async function organizerPartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => { await setOrganizerPartner(a.user.id, str(fd, "id"), bool(fd, "isPartner"), str(fd, "contractRef")); });
}

export async function clubDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => { await decideClub(a.user.id, str(fd, "id"), decision(fd), str(fd, "reason")); });
}

export async function clubRateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => { await rateClub(a.user.id, str(fd, "id"), int(fd, "stars")); });
}

export async function eventDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => {
    const s = str(fd, "status");
    if (!["approved", "rejected", "canceled"].includes(s)) throw new AppError("status", "Ungültiger Status.");
    await decideEvent(a.user.id, str(fd, "id"), s as "approved", bool(fd, "goldEligible"));
  });
}

export async function providerPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("events.manage", async (a) => {
    await confirmProviderPayment(a.user.id, str(fd, "ticketOrderId"), str(fd, "note"));
    return { ok: true, message: "Zahlung beim Anbieter bestätigt." };
  });
}
