"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import {
  applyAsModerator, applyForGroup, createThread, editPost, joinGroup, moderateGroupMember, replyToThread, requireCommunity,
} from "@/server/community";
import { db } from "@/server/db";
import { AppError, forbidden, notFound } from "@/server/errors";
import { isAllowedCountry } from "@/domain/countries";

export async function applyGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const vis = str(fd, "visibility");
    const visibility = vis === "closed" || vis === "invite" ? vis : "open";
    const country = str(fd, "regionCountry").toUpperCase();
    if (country && !isAllowedCountry(country)) throw new AppError("country", "Land nicht unterstützt.");
    const description = str(fd, "description");
    if (description.length > 4000) throw new AppError("description", "Beschreibung: höchstens 4000 Zeichen.");
    await applyForGroup(userId, profileId, {
      name: str(fd, "name").slice(0, 80), description, category: str(fd, "category") || "Community", visibility,
      rules: str(fd, "rules").slice(0, 4000) || undefined, regionCountry: country || undefined, regionName: str(fd, "regionName") || undefined,
      proposedModerators: str(fd, "moderators").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5),
    });
    return { ok: true, message: "Danke! Dein Gruppenantrag wird vom eropub-Team geprüft. Bis zur Freigabe ist die Gruppe nicht sichtbar." };
  });
}

export async function joinGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const status = await joinGroup(userId, profileId, str(fd, "groupId"));
    revalidatePath("/app/community", "layout");
    return { ok: true, message: status === "active" ? "Willkommen in der Gruppe!" : "Beitrittsanfrage gesendet – die Moderation entscheidet." };
  });
}

export async function leaveGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { profileId } = await actingProfile();
    const r = await db.groupMembership.updateMany({
      where: { groupId: str(fd, "groupId"), profileId, status: { in: ["active", "pending"] } }, data: { status: "removed" },
    });
    if (!r.count) throw new AppError("not_member", "Du bist kein Mitglied dieser Gruppe.");
    revalidatePath("/app/community", "layout");
    return { ok: true, message: "Du hast die Gruppe verlassen." };
  });
}

export async function createThreadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const body = str(fd, "body");
    if (body.length > 10000) throw new AppError("body", "Höchstens 10.000 Zeichen.");
    const title = str(fd, "title");
    if (title.length > 160) throw new AppError("title", "Titel: höchstens 160 Zeichen.");
    const t = await createThread(userId, profileId, str(fd, "categoryId"), title, body);
    redirect(`/app/community/thema/${t.id}`);
  });
}

export async function replyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const body = str(fd, "body");
    if (body.length > 10000) throw new AppError("body", "Höchstens 10.000 Zeichen.");
    const threadId = str(fd, "threadId");
    const quoteId = str(fd, "quoteId") || undefined;
    if (quoteId) {
      const q = await db.post.findUnique({ where: { id: quoteId } });
      if (!q || q.threadId !== threadId) throw new AppError("quote", "Zitat gehört nicht zu diesem Thema.");
    }
    await replyToThread(userId, profileId, threadId, body, quoteId);
    revalidatePath(`/app/community/thema/${threadId}`);
    return { ok: true, message: "Antwort veröffentlicht." };
  });
}

export async function editPostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await requireCommunity(userId, profileId);
    const body = str(fd, "body");
    if (!body) throw new AppError("body", "Bitte Text eingeben.");
    if (body.length > 10000) throw new AppError("body", "Höchstens 10.000 Zeichen.");
    const post = await db.post.findUnique({ where: { id: str(fd, "postId") }, include: { thread: true } });
    if (!post) throw notFound();
    if (post.thread.locked) throw forbidden("Dieses Thema ist geschlossen.");
    await editPost(userId, profileId, post.id, body);
    revalidatePath(`/app/community/thema/${post.threadId}`);
    return { ok: true, message: "Beitrag aktualisiert." };
  });
}

export async function moderatorApplyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await applyAsModerator(userId, profileId, str(fd, "groupId"), str(fd, "motivation"));
    revalidatePath("/app/community", "layout");
    return { ok: true, message: "Deine Bewerbung ist eingegangen. Über die Ernennung entscheidet das eropub-Team." };
  });
}

export async function moderateMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingProfile();
    const action = str(fd, "action");
    if (!["approve", "remove", "mute", "unmute"].includes(action)) throw new AppError("action", "Ungültige Aktion.");
    const groupId = str(fd, "groupId");
    const target = await db.groupMembership.findUnique({ where: { groupId_profileId: { groupId, profileId: str(fd, "targetProfileId") } } });
    if (!target) throw notFound();
    await moderateGroupMember(userId, groupId, target.profileId, action as "approve" | "remove" | "mute" | "unmute");
    revalidatePath("/app/community", "layout");
    const msg: Record<string, string> = { approve: "Beitritt bestätigt.", remove: "Mitglied entfernt.", mute: "Schreibrecht entzogen.", unmute: "Schreibrecht wiederhergestellt." };
    return { ok: true, message: msg[action] };
  });
}
