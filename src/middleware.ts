import { NextResponse, type NextRequest } from "next/server";

/** Gibt den Pfad (inkl. Query) an Server Components weiter – für Login-Rücksprung (?next=). */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/app/:path*"] };
