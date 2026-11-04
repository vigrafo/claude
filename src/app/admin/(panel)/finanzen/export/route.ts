import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "../../../_lib/guard";
import { requireRecentReauth } from "@/server/admin/guard";
import { exportOrdersCsv } from "@/server/admin/finance";
import { AppError } from "@/server/errors";
import { orderFilterFrom } from "../filters";

export const dynamic = "force-dynamic";

/** CSV-Export: Recht finance.read + frische Re-Authentifizierung; wird auditiert. */
export async function GET(req: NextRequest) {
  try {
    const a = await adminGuard("finance.read");
    requireRecentReauth(a);
    const csv = await exportOrdersCsv(a.user.id, orderFilterFrom(req.nextUrl.searchParams));
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="bestellungen-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "reauth_required") {
      return NextResponse.redirect(new URL(`/admin/reauth?next=${encodeURIComponent("/admin/finanzen")}`, req.url));
    }
    if (e instanceof AppError) return new NextResponse(e.message, { status: e.status });
    throw e;
  }
}
