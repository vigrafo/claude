"use server";
import { redirect } from "next/navigation";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { accessMessageEvidence, caseForReport } from "@/server/admin/moderation";

export async function reportCaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("messages.moderate", async (a) => {
    await caseForReport(a.user.id, str(fd, "reportId"));
    return { ok: true, message: "Moderationsfall zugeordnet." };
  });
}

/** Belegzugriff wird VOR der Anzeige protokolliert; danach Weiterleitung auf die befristete Ansicht. */
export async function messageEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("moderation.evidence", async (a) => {
    const reportId = str(fd, "reportId");
    const accessId = await accessMessageEvidence(a.user.id, reportId, str(fd, "purpose"));
    redirect(`/admin/nachrichten?report=${encodeURIComponent(reportId)}&access=${encodeURIComponent(accessId)}`);
  });
}
