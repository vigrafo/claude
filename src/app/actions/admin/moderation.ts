"use server";
import { bool, int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { decideAppeal, moderationAction, MOD_ACTIONS, recordAppeal, replyTicket, updateCase, updateTicket, type ModAction } from "@/server/admin/moderation";

export async function caseActionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("moderation.handle", async (a) => {
    const action = str(fd, "action") as ModAction;
    if (!MOD_ACTIONS.includes(action)) throw new AppError("action", "Unbekannte Aktion.");
    await moderationAction(a.user.id, str(fd, "caseId"), action, str(fd, "reasoning"));
    return { ok: true, message: "Maßnahme protokolliert." };
  });
}

export async function caseUpdateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("moderation.handle", async (a) => {
    const assignee = str(fd, "assignee");
    const due = str(fd, "dueAt");
    await updateCase(a.user.id, str(fd, "caseId"), {
      status: str(fd, "status") || undefined,
      assigneeId: assignee === "me" ? a.user.id : assignee === "none" ? null : undefined,
      dueAt: due ? new Date(due) : undefined,
      priority: str(fd, "priority") ? int(fd, "priority") : undefined,
    });
  });
}

export async function appealAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("moderation.handle", async (a) => {
    if (str(fd, "op") === "record") await recordAppeal(a.user.id, str(fd, "caseId"), str(fd, "appeal"));
    else await decideAppeal(a.user.id, str(fd, "caseId"), str(fd, "op") === "overturn", str(fd, "reasoning"));
  });
}

export async function ticketReplyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("support.handle", async (a) => {
    await replyTicket(a.user.id, str(fd, "ticketId"), String(fd.get("body") ?? ""), bool(fd, "internal"));
    return { ok: true, message: bool(fd, "internal") ? "Interne Notiz gespeichert." : "Antwort gespeichert (Person wird benachrichtigt)." };
  });
}

export async function ticketUpdateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("support.handle", async (a) => {
    await updateTicket(a.user.id, str(fd, "ticketId"), { status: str(fd, "status") || undefined, assignToMe: str(fd, "assign") === "me", unassign: str(fd, "assign") === "none" });
  });
}

export async function reportCaseModAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("moderation.handle", async (a) => {
    const { caseForReport } = await import("@/server/admin/moderation");
    await caseForReport(a.user.id, str(fd, "reportId"));
    return { ok: true, message: "Meldung einem Fall zugeordnet." };
  });
}
