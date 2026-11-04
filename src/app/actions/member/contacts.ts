"use server";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import {
  endConnection, respondContactRequest, sendContactRequest, setLike, toggleFavorite, withdrawContactRequest,
} from "@/server/contacts";
import { blockProfile, unblockProfile } from "@/server/safety";
import { createReport } from "@/server/reports";
import { AppError } from "@/server/errors";

export async function sendContactRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const r = await sendContactRequest(userId, profileId, str(fd, "targetId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: r.status === "connected" ? "Ihr seid jetzt verbunden." : "Deine Kontaktanfrage wurde gesendet." };
  });
}

export async function respondContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const accept = str(fd, "accept") === "1";
    await respondContactRequest(userId, profileId, str(fd, "requestId"), accept);
    revalidatePath("/app", "layout");
    return { ok: true, message: accept ? "Angenommen – ihr seid jetzt verbunden." : "Anfrage abgelehnt." };
  });
}

export async function withdrawContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await withdrawContactRequest(userId, profileId, str(fd, "requestId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Anfrage zurückgezogen." };
  });
}

export async function endConnectionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await endConnection(userId, profileId, str(fd, "targetId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Verbindung beendet." };
  });
}

export async function toggleFavoriteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const on = await toggleFavorite(userId, profileId, str(fd, "targetId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: on ? "Zu Favoriten hinzugefügt." : "Aus Favoriten entfernt." };
  });
}

export async function likeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const value = str(fd, "value") === "like" ? "like" : "pass";
    const r = await setLike(userId, profileId, str(fd, "targetId"), value);
    revalidatePath("/app/entdecken/bilder");
    return { ok: true, message: r.mutual ? "Gegenseitiges Interesse! Ein Kontakt entsteht erst, wenn ihr eine Kontaktanfrage annehmt." : value === "like" ? "Gemerkt." : "Weiter geht's." };
  });
}

export async function blockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await blockProfile(userId, profileId, str(fd, "targetId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Profil blockiert. Ihr seht euch gegenseitig nicht mehr und könnt nicht mehr schreiben." };
  });
}

export async function unblockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await unblockProfile(userId, profileId, str(fd, "targetId"));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Blockierung aufgehoben." };
  });
}

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    if (!str(fd, "reason")) throw new AppError("reason", "Bitte wähle einen Grund.");
    const r = await createReport(userId, profileId, {
      targetType: str(fd, "targetType"), targetId: str(fd, "targetId"), reason: str(fd, "reason"), details: str(fd, "details"),
    });
    return { ok: true, message: `Danke! Deine Meldung ist bei uns eingegangen (Vorgang ${r.caseNumber}). Das Team prüft sie vertraulich.` };
  });
}
