import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { pageArgs } from "@/server/admin/guard";
import { Empty, formatDate } from "@/components/ui";

const ST = ["pending_review", "in_progress", "verified", "rejected", "expired", "revoked"];

export default async function VerifizierungPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("verification.review");
  const params = await searchParams;
  const status = sp(params, "status");
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.VerificationCaseWhereInput = status && ST.includes(status)
    ? { status: status as Prisma.VerificationCaseWhereInput["status"] }
    : { status: { in: ["pending_review", "in_progress"] } };
  if (q) where.OR = [{ id: q }, { userId: q }, { providerRef: q }];
  const [rows, total, appeals] = await Promise.all([
    // Prioritätswarteschlange: pending_review zuerst, dann Priorität (Einsprüche = 5), dann Alter
    db.verificationCase.findMany({ where, skip, take, orderBy: [{ status: "desc" }, { priority: "desc" }, { createdAt: "asc" }] }),
    db.verificationCase.count({ where }),
    db.verificationCase.count({ where: { status: "pending_review", appealAt: { not: null } } }),
  ]);
  return (
    <>
      <PageHead title="Verifizierung">Prüfwarteschlange: zu prüfende Fälle und Einsprüche zuerst. Ausweisbilder verarbeitet ausschließlich der Anbieter.</PageHead>
      {appeals > 0 && <p className="alert warn">{appeals} offene Einsprüche in der Warteschlange.</p>}
      <SearchBar base="/admin/verifizierung" q={q} params={params} placeholder="Fall-ID, Personen-ID oder Anbieterreferenz"
        filters={[{ name: "status", label: "Status", options: ST.map((s) => ({ value: s, label: s })) }]} />
      {rows.length === 0 ? <Empty title="Keine Fälle in dieser Ansicht" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fall</th><th>Status</th><th>Priorität</th><th>Anbieter</th><th>Dokument</th><th>Volljährigkeit</th><th>Einspruch</th><th>Erstellt</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/verifizierung/${c.id}`} className="admin-mono">{c.id.slice(0, 10)}…</Link></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.priority}</td>
                  <td>{c.provider}</td>
                  <td>{c.documentType ?? "–"} {c.documentCountry ?? ""}</td>
                  <td>{c.adultConfirmed === true ? "bestätigt" : c.adultConfirmed === false ? "nicht bestätigt" : "offen"}</td>
                  <td>{c.appealAt ? formatDate(c.appealAt) : "–"}</td>
                  <td>{formatDate(c.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/verifizierung" params={params} page={page} total={total} />
    </>
  );
}
