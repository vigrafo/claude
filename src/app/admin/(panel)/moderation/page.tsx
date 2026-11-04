import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { CASE_STATUSES } from "@/server/admin/moderation";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { reportCaseModAction as reportCaseAction } from "@/app/actions/admin/moderation";

export default async function ModerationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("moderation.handle");
  const params = await searchParams;
  const status = sp(params, "status");
  const prio = sp(params, "prio");
  const assignee = sp(params, "assignee");
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.ModerationCaseWhereInput = status ? { status } : { status: { in: ["open", "in_review", "appealed"] } };
  if (prio) where.priority = { gte: Number(prio) || 0 };
  if (assignee === "me") where.assigneeId = a.user.id;
  if (assignee === "none") where.assigneeId = null;
  if (q) where.OR = [{ number: { contains: q, mode: "insensitive" } }, { targetId: q }];
  const [cases, total, unlinked] = await Promise.all([
    db.moderationCase.findMany({ where, skip, take, orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }] }),
    db.moderationCase.count({ where }),
    db.report.findMany({ where: { caseId: null }, orderBy: { createdAt: "asc" }, take: 30 }),
  ]);
  const reportCounts = await db.report.groupBy({ by: ["caseId"], where: { caseId: { in: cases.map((c) => c.id) } }, _count: { _all: true } });
  return (
    <>
      <PageHead title="Moderation">Fälle mit Meldungen, Maßnahmen mit Begründung, Fristen und Einsprüchen.</PageHead>
      <SearchBar base="/admin/moderation" q={q} params={params} placeholder="Fallnummer oder Ziel-ID" filters={[
        { name: "status", label: "Status", options: CASE_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "prio", label: "Priorität ab", options: ["1", "3", "5", "8"].map((p) => ({ value: p, label: `≥ ${p}` })) },
        { name: "assignee", label: "Zuständig", options: [{ value: "me", label: "ich" }, { value: "none", label: "niemand" }] },
      ]} />
      {cases.length === 0 ? <Empty title="Keine Fälle in dieser Ansicht" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Fall</th><th>Ziel</th><th>Meldungen</th><th>Priorität</th><th>Status</th><th>Frist</th><th>Zuständig</th></tr></thead>
          <tbody>{cases.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/moderation/${c.id}`}>{c.number}</Link></td><td>{c.targetType}</td>
              <td>{reportCounts.find((r) => r.caseId === c.id)?._count._all ?? 0}</td><td>{c.priority}</td><td><StatusBadge status={c.status} /></td>
              <td>{c.dueAt ? <span className={c.dueAt < new Date() ? "badge unverified" : ""}>{formatDate(c.dueAt, true)}</span> : "–"}</td>
              <td>{c.assigneeId === a.user.id ? "ich" : c.assigneeId ? c.assigneeId.slice(0, 8) : "–"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager base="/admin/moderation" params={params} page={page} total={total} />
      <section className="admin-section">
        <h2>Neue Meldungen ohne Fall</h2>
        {unlinked.length === 0 ? <p className="muted">Keine.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Gemeldet</th><th>Ziel</th><th>Grund</th><th>Aktion</th></tr></thead>
            <tbody>{unlinked.map((r) => (
              <tr key={r.id}><td>{formatDate(r.createdAt, true)}</td><td>{r.targetType}</td><td>{r.reason}</td>
                <td><ActionForm action={reportCaseAction} submit="Fall anlegen/zuordnen" submitClass="btn small secondary"><input type="hidden" name="reportId" value={r.id} /></ActionForm></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
