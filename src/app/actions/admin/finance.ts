"use server";
import { int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { confirmBankTransfer } from "@/server/admin/finance";

export async function bankTransferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("finance.manage", async (a) => {
    await confirmBankTransfer(a.user.id, str(fd, "orderId"), { reference: str(fd, "reference"), amountCents: int(fd, "amountCents"), reason: str(fd, "reason") });
    return { ok: true, message: "Überweisung verbucht und Bestellung erfüllt." };
  });
}
