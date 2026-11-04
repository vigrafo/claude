import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { TICKET_STATUSES } from "@/server/admin/moderation";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";

export default async function SupportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("support.handle");
  const params = await searchParams;
  const status = sp(params, "status");
  const assignee = sp(params, "assignee");
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.SupportTicketWhereInput = status ? { status } : { status: { in: ["open", "pending"] } };
  if (assignee === "me") where.assigneeId = a.user.id;
  if (assignee === "none") where.assigneeId = null;
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { topic: { contains: q, mode: "insensitive" } }];
  const [rows, total] = await Promise.all([
    db.supportTicket.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { _count: { select: { replies: true } } } }),
    db.supportTicket.count({ where }),
  ]);
  return (
    <>
      <PageHead title="Support">Anfragen aus Kontaktformular und Konto. Interne Notizen sind für Mitglieder nicht sichtbar.</PageHead>
      <SearchBar base="/admin/support" q={q} params={params} placeholder="Ticketnummer oder Thema" filters={[
        { name: "status", label: "Status", options: TICKET_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "assignee", label: "Zuständig", options: [{ value: "me", label: "ich" }, { value: "none", label: "niemand" }] },
      ]} />
      {rows.length === 0 ? <Empty title="Keine Tickets in dieser Ansicht" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Ticket</th><th>Thema</th><th>Status</th><th>Antworten</th><th>Zuständig</th><th>Eingang</th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.id}><td><Link href={`/admin/support/${t.id}`}>{t.number}</Link></td><td>{t.topic}</td><td><StatusBadge status={t.status} /></td><td>{t._count.replies}</td><td>{t.assigneeId === a.user.id ? "ich" : t.assigneeId ? "andere" : "–"}</td><td>{formatDate(t.createdAt, true)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager base="/admin/support" params={params} page={page} total={total} />
    </>
  );
}
