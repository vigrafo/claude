"use server";
import { str, type ActionState } from "@/lib/actions";
import { adminAct } from "@/app/admin/_lib/guard";
import { AppError } from "@/server/errors";
import { accessEvidence, decideCase, requestResubmission } from "@/server/admin/verification";
import { formatDate } from "@/components/ui";

export async function verificationDecideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("verification.review", async (a) => {
    const d = str(fd, "decision");
    if (!["verified", "rejected", "revoked"].includes(d)) throw new AppError("decision", "Ungültige Entscheidung.");
    await decideCase(a.user.id, str(fd, "caseId"), d as "verified" | "rejected" | "revoked", str(fd, "reason"));
    return { ok: true, message: "Entscheidung gespeichert." };
  });
}

export async function verificationResubmitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("verification.review", async (a) => {
    await requestResubmission(a.user.id, str(fd, "caseId"), str(fd, "detail"));
    return { ok: true, message: "Nachforderung gesendet (Fall abgelehnt mit Grund „Nachforderung“)." };
  });
}

export async function verificationEvidenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return adminAct("verification.evidence", async (a) => {
    const r = await accessEvidence(a.user.id, str(fd, "caseId"), str(fd, "purpose"));
    return {
      ok: true,
      message: r.present
        ? `Zugriff protokolliert. Ein temporärer Beleg ist hinterlegt (Löschfrist ${formatDate(r.purgeAt, true)}). Der Abruf erfolgt ausschließlich im Prüfportal des Anbieters – eropub zeigt keine Ausweisbilder an.`
        : "Zugriff protokolliert. Zu diesem Fall ist kein Beleg gespeichert.",
    };
  });
}
