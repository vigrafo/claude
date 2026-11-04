"use server";
import { revalidatePath } from "next/cache";
import { int, run, str, type ActionState } from "@/lib/actions";
import { actingProfile } from "@/app/app/_lib/server";
import { closeDate, createDate } from "@/server/dates";
import { AppError } from "@/server/errors";

export async function createDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    const whenRaw = str(fd, "when");
    let when: Date | null = null;
    if (whenRaw) {
      when = new Date(whenRaw);
      if (Number.isNaN(when.getTime())) throw new AppError("when", "Ungültiger Termin.");
    }
    const max = int(fd, "maxPeople");
    await createDate(userId, profileId, {
      kind: str(fd, "kind") === "group" ? "group" : "personal", title: str(fd, "title"), description: str(fd, "description"),
      postalCode: str(fd, "postalCode"), country: str(fd, "country"), when,
      preferences: str(fd, "preferences").split(","), maxPeople: Number.isFinite(max) ? max : null,
    });
    revalidatePath("/app/dates");
    return { ok: true, message: "Dein Date ist online." };
  });
}

export async function closeDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId, profileId } = await actingProfile();
    await closeDate(userId, profileId, str(fd, "dateId"));
    revalidatePath("/app/dates");
    return { ok: true, message: "Date geschlossen." };
  });
}
