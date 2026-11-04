import { NextResponse, type NextRequest } from "next/server";
import { handleWebhook } from "@/server/payments/service";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/** Zahlungs-Webhooks. Erfüllung erfolgt ausschließlich hier nach Signatur-/Herkunftsprüfung. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const rawBody = await req.text();
  if (rawBody.length > 200_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const sourceIp = (req.headers.get("x-forwarded-for")?.split(",").at(-1) ?? req.headers.get("x-real-ip") ?? "").trim();
  try {
    const r = await handleWebhook(provider, { rawBody, headers, query, sourceIp });
    return NextResponse.json(r);
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    // Keine Details nach außen
    return NextResponse.json({ error: e instanceof AppError ? e.code : "error" }, { status });
  }
}
