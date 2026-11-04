"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { answerCall, endCall, reportCallFailure, startCall } from "@/server/calls";

export async function startCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const mode = str(fd, "mode") === "video" ? "video" : "audio";
    const r = await startCall(userId, profileId, str(fd, "targetId"), mode);
    if (r.status === "busy") return { ok: true, message: "Besetzt – du oder dein Kontakt seid gerade in einem anderen Gespräch." };
    redirect(`/app/anrufe/${r.callId}`);
  });
}

export async function answerCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const accept = str(fd, "accept") === "1";
    const r = await answerCall(userId, profileId, str(fd, "callId"), accept);
    revalidatePath("/app/anrufe");
    if (r.status === "declined") return { ok: true, message: "Anruf abgelehnt." };
    redirect(`/app/anrufe/${r.callId}`);
  });
}

export async function endCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await endCall(userId, profileId, str(fd, "callId"));
    revalidatePath("/app/anrufe");
    return { ok: true, message: "Anruf beendet." };
  });
}

/** Direkt aus dem Anruffenster aufgerufen. */
export async function hangupCall(callId: string): Promise<void> {
  const { userId, profileId } = await actingProfile();
  await endCall(userId, profileId, callId);
}

export async function reportCallProblem(callId: string, reason: string): Promise<void> {
  const { userId, profileId } = await actingProfile();
  await reportCallFailure(userId, profileId, callId, reason);
}
