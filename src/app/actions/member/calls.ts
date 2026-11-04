"use server";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { answerCall, endCall, startCall } from "@/server/calls";

const TOKEN_NOTE = "Ein kurzlebiger, raumgebundener Zugangsschlüssel wurde ausgestellt. Kamera und Mikrofon werden erst nach deiner ausdrücklichen Freigabe im Anruffenster aktiviert.";

export async function startCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const mode = str(fd, "mode") === "video" ? "video" : "audio";
    const r = await startCall(userId, profileId, str(fd, "targetId"), mode);
    revalidatePath("/app/anrufe");
    if (r.status === "busy") return { ok: true, message: "Das Profil ist gerade in einem anderen Gespräch." };
    return { ok: true, message: `Es klingelt … ${TOKEN_NOTE}` };
  });
}

export async function answerCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const accept = str(fd, "accept") === "1";
    const r = await answerCall(userId, profileId, str(fd, "callId"), accept);
    revalidatePath("/app/anrufe");
    return { ok: true, message: r.status === "declined" ? "Anruf abgelehnt." : `Anruf angenommen. ${TOKEN_NOTE}` };
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
