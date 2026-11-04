"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { confirmAnswers, consentContact, consentJoin, inviteGame, setAnswer, viewSession } from "@/server/games";
import { GAME_VARIANTS, type GameVariant } from "@/domain/games";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { isBlockedEitherWay } from "@/server/state";

export async function inviteGameAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const variant = str(fd, "variant") as GameVariant;
    if (!(variant in GAME_VARIANTS)) throw new AppError("variant", "Bitte wähle eine Spielvariante.");
    const target = await db.communityProfile.findUnique({ where: { handle: str(fd, "handle").replace(/^@/, "") } });
    if (!target || target.id === profileId || (await isBlockedEitherWay(profileId, target.id))) throw notFound("Paarprofil nicht gefunden.");
    const s = await inviteGame(userId, profileId, target.id, variant);
    redirect(`/app/spiele/${s.id}`);
  });
}

export async function consentJoinAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const sessionId = str(fd, "sessionId");
    const accept = str(fd, "accept") === "1";
    const r = await consentJoin(userId, sessionId, profileId, accept);
    revalidatePath(`/app/spiele/${sessionId}`);
    const msg = r === "declined" ? "Ihr habt die Einladung abgelehnt." : r === "answering" ? "Alle sind dabei – ihr könnt jetzt antworten." : "Deine Zustimmung ist gespeichert. Wir warten auf die anderen Personen.";
    return { ok: true, message: msg };
  });
}

/** Speichert nur geänderte Antworten (jede Änderung setzt die Bestätigungen eures Paars zurück). */
export async function saveAnswersAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const sessionId = str(fd, "sessionId");
    const s = await viewSession(userId, sessionId, profileId);
    let changed = 0;
    for (const q of [...s.questions, ...s.reserve]) {
      const raw = fd.get(`q_${q.key}`);
      if (typeof raw !== "string") continue;
      const next = raw === "__skip" ? null : raw;
      const mine = s.myAnswers as Record<string, string | null>;
      if (q.key in mine && mine[q.key] === next) continue;
      await setAnswer(userId, sessionId, profileId, q.key, next);
      changed++;
    }
    revalidatePath(`/app/spiele/${sessionId}`);
    return { ok: true, message: changed ? `${changed} ${changed === 1 ? "Antwort" : "Antworten"} gespeichert. Bitte bestätigt eure Antworten erneut.` : "Keine Änderungen." };
  });
}

export async function confirmAnswersAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const sessionId = str(fd, "sessionId");
    const r = await confirmAnswers(userId, sessionId, profileId);
    revalidatePath(`/app/spiele/${sessionId}`);
    return { ok: true, message: r.state === "submitted" ? "Eure Antworten sind abgegeben und gesperrt." : "Bestätigt. Jetzt muss deine Partnerperson dieselbe Antwortversion bestätigen." };
  });
}

export async function consentContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const sessionId = str(fd, "sessionId");
    const r = await consentContact(userId, sessionId, profileId);
    revalidatePath(`/app/spiele/${sessionId}`);
    return { ok: true, message: r.connected ? "Alle vier haben zugestimmt – ihr seid jetzt verbunden." : `Zustimmung gespeichert (${r.consents}/4).` };
  });
}
