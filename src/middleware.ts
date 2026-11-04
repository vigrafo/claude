import { NextResponse, type NextRequest } from "next/server";

/**
 * Laufzeit-Header (werden NICHT beim Build festgeschrieben, damit Docker-Images je Umgebung funktionieren):
 * - Content-Security-Policy inkl. LiveKit-URL für Anrufe
 * - X-Robots-Tag: Suchmaschinen gesperrt, solange ALLOW_SEARCH_INDEXING !== "true"
 * - x-pathname an Server Components (Login-Rücksprung ?next=)
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });

  const rtc = process.env.LIVEKIT_PUBLIC_URL ?? process.env.LIVEKIT_URL ?? "";
  const rtcHttp = rtc.replace(/^ws(s?):/, "http$1:");
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${rtc} ${rtcHttp}`.trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  if (process.env.ALLOW_SEARCH_INDEXING !== "true") res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image).*)"],
};
