"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, str, type ActionState } from "@/lib/actions";
import { actingUser } from "@/app/app/_lib/server";
import { appealVerification, startVerification } from "@/server/verification";
import { AppError } from "@/server/errors";
import { isAllowedCountry } from "@/domain/countries";
import { rateLimit } from "@/server/ratelimit";

export async function startVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    const country = str(fd, "country").toUpperCase();
    if (!isAllowedCountry(country)) throw new AppError("country", "Bitte wähle das ausstellende Land.");
    await rateLimit("verify_start", userId, 10, 3600);
    const r = await startVerification(userId, str(fd, "documentType"), country);
    redirect(r.redirectUrl.startsWith("/verifizierung?") ? `/app/verifizierung?case=${r.caseId}` : r.redirectUrl);
  });
}

export async function appealVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { userId } = await actingUser();
    const text = str(fd, "text");
    if (text.length < 20) throw new AppError("text", "Bitte beschreibe kurz (mind. 20 Zeichen), warum wir erneut prüfen sollen.");
    if (text.length > 2000) throw new AppError("text", "Höchstens 2000 Zeichen.");
    await appealVerification(userId, str(fd, "caseId"), text);
    revalidatePath("/app/verifizierung");
    return { ok: true, message: "Dein Widerspruch ist eingegangen. Wir prüfen den Fall manuell." };
  });
}
