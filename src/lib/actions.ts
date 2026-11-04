import "server-only";
import { AppError } from "@/server/errors";
import { ZodError } from "zod";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
}

/** Einheitliche Fehlerbehandlung für Server Actions – keine internen Details an Clients. */
export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    const r = await fn();
    return r ?? { ok: true };
  } catch (e) {
    // redirect()/notFound() von Next.js durchreichen
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] = i.message;
      return { ok: false, error: "Bitte prüfe deine Eingaben.", fieldErrors };
    }
    console.error("[action]", (e as Error)?.message);
    return { ok: false, error: "Das hat leider nicht geklappt. Bitte versuche es erneut." };
  }
}

export function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
export function int(fd: FormData, k: string): number {
  return Number.parseInt(str(fd, k), 10);
}
export function bool(fd: FormData, k: string): boolean {
  const v = fd.get(k);
  return v === "on" || v === "true" || v === "1";
}
