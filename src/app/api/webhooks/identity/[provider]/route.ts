import { NextResponse, type NextRequest } from "next/server";
import { applyProviderResult } from "@/server/verification";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * Ergebnis-Callback des Identitätsanbieters (HMAC-Signatur in Header x-signature).
 * Erwartetes Format (Adapter-intern normalisiert): { providerRef, result, adult, validUntil?, reason? }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const rawBody = await req.text();
  try {
    const j = JSON.parse(rawBody) as { providerRef: string; result: "verified" | "rejected" | "needs_review"; adult: boolean; validUntil?: string; reason?: string };
    await applyProviderResult({
      provider, providerRef: j.providerRef, result: j.result, adult: !!j.adult, validUntil: j.validUntil ? new Date(j.validUntil) : undefined,
      reason: j.reason, signature: req.headers.get("x-signature") ?? "", rawBody,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 400;
    return NextResponse.json({ error: e instanceof AppError ? e.code : "invalid" }, { status });
  }
}
