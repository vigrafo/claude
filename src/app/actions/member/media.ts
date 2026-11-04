"use server";
import { revalidatePath } from "next/cache";
import { bool, run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { deleteOwnMedia, setVisibility, uploadImage, type UploadPurpose, type Visibility } from "@/server/uploads";
import { AppError } from "@/server/errors";
import { db } from "@/server/db";
import { sendMessage } from "@/server/messaging";
import { randomUUID } from "node:crypto";

async function fileBuffer(fd: FormData): Promise<Buffer> {
  const f = fd.get("file");
  if (!f || typeof f === "string" || f.size === 0) throw new AppError("upload_empty", "Bitte wähle ein Bild aus.");
  return Buffer.from(await f.arrayBuffer());
}

export async function uploadPhotoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const purpose = (str(fd, "purpose") === "profile" ? "profile" : "gallery") as UploadPurpose;
    await uploadImage({
      userId, profileId, file: await fileBuffer(fd), purpose, visibility: str(fd, "visibility") as Visibility,
      rightsConfirmed: bool(fd, "rights"),
    });
    revalidatePath("/app/profil/fotos");
    return { ok: true, message: "Danke! Dein Bild wurde ohne Metadaten gespeichert und wird vor der Veröffentlichung geprüft." };
  });
}

export async function uploadGroupPhotoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await uploadImage({ userId, profileId, file: await fileBuffer(fd), purpose: "group", scopeId: str(fd, "groupId"), rightsConfirmed: bool(fd, "rights") });
    revalidatePath(`/app/community/${str(fd, "slug")}`);
    return { ok: true, message: "Danke! Das Bild erscheint nach der Prüfung in der Gruppengalerie." };
  });
}

export async function setPhotoVisibilityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await setVisibility(userId, profileId, str(fd, "id"), str(fd, "visibility") as Visibility);
    revalidatePath("/app/profil/fotos");
    return { ok: true, message: "Freigabe gespeichert." };
  });
}

export async function deletePhotoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await deleteOwnMedia(userId, profileId, str(fd, "id"));
    revalidatePath("/app/profil/fotos");
    return { ok: true, message: "Bild gelöscht." };
  });
}

/** Bild im Chat: Upload (privat, nur Konversation) + Versand als Nachricht. Bei Fehlschlag wird das Bild wieder entfernt. */
export async function sendPhotoMessageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const conversationId = str(fd, "conversationId");
    const part = await db.conversationParticipant.findMany({ where: { conversationId } });
    const other = part.find((x) => x.profileId !== profileId);
    if (!other || !part.some((x) => x.profileId === profileId)) throw new AppError("forbidden", "Keine Berechtigung.", 403);
    const asset = await uploadImage({ userId, profileId, file: await fileBuffer(fd), purpose: "message", scopeId: conversationId, rightsConfirmed: bool(fd, "rights") });
    try {
      const r = await sendMessage({
        actorUserId: userId, fromProfileId: profileId, toProfileId: other.profileId, body: str(fd, "caption"),
        clientKey: str(fd, "clientKey") || randomUUID(), kind: "media", mediaId: asset.id,
      });
      revalidatePath(`/app/nachrichten/${conversationId}`);
      return { ok: true, message: r.tokenCost ? `Bild gesendet (${r.tokenCost} Token, Guthaben ${r.balance}).` : "Bild gesendet." };
    } catch (e) {
      await deleteOwnMedia(userId, profileId, asset.id).catch(() => undefined);
      throw e;
    }
  });
}
