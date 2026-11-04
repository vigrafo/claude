"use server";
import { int, str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { activateRuleVersion, approveQuestion, archiveQuestion, createQuestion, createRuleVersion, editQuestion } from "@/server/admin/games";

const lines = (fd: FormData) => String(fd.get("options") ?? "").split(/\r?\n/);

export async function questionCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("games.manage", async (a) => {
    await createQuestion(a.user.id, { variant: str(fd, "variant"), category: str(fd, "category"), text: str(fd, "text"), options: lines(fd) });
    return { ok: true, message: "Frage als Entwurf angelegt – bitte freigeben." };
  });
}

export async function questionEditAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("games.manage", async (a) => {
    const q = await editQuestion(a.user.id, str(fd, "id"), { category: str(fd, "category"), text: str(fd, "text"), options: lines(fd) });
    return { ok: true, message: `Neue Version v${q.version} als Entwurf angelegt. Die freigegebene Version bleibt unverändert.` };
  });
}

export async function questionStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("games.manage", async (a) => {
    if (str(fd, "op") === "approve") await approveQuestion(a.user.id, str(fd, "id"));
    else await archiveQuestion(a.user.id, str(fd, "id"));
  });
}

export async function ruleCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("games.manage", async (a) => {
    const r = await createRuleVersion(a.user.id, {
      roundSize: int(fd, "roundSize"), minAnswered: int(fd, "minAnswered"), thresholdBp: int(fd, "thresholdBp"),
      inviteLimitPerDay: int(fd, "inviteLimitPerDay"), expiresHours: int(fd, "expiresHours"),
    });
    return { ok: true, message: `Regelversion v${r.version} angelegt (inaktiv).` };
  });
}

export async function ruleActivateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("games.manage", async (a) => {
    await activateRuleVersion(a.user.id, str(fd, "id"));
    return { ok: true, message: "Regelversion aktiviert. Laufende Runden behalten ihren Snapshot." };
  });
}
