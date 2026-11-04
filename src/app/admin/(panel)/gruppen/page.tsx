import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, SearchBar, Select, StatusBadge, TextArea, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { groupCreateAction, modApplicationAction } from "@/app/actions/admin/groups";

const ST = ["pending_approval", "approved", "rejected", "suspended", "archived", "draft"];

export default async function GruppenPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("groups.manage");
  const params = await searchParams;
  const status = sp(params, "status") || "pending_approval";
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.GroupWhereInput = { status: ST.includes(status) ? (status as Prisma.GroupWhereInput["status"]) : "pending_approval" };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q } }];
  const [groups, total, modApps] = await Promise.all([
    db.group.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { _count: { select: { memberships: { where: { status: "active" } } } } } }),
    db.group.count({ where }),
    db.groupModeratorApplication.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, include: { group: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHead title="Gruppen">Nur die eropub-Administration gibt Gruppen frei und ernennt Moderatoren.</PageHead>
      <SearchBar base="/admin/gruppen" q={q} params={params} filters={[{ name: "status", label: "Status", options: ST.map((s) => ({ value: s, label: s })) }]} />
      {groups.length === 0 ? <Empty title="Keine Gruppen in dieser Ansicht" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Gruppe</th><th>Kategorie</th><th>Sichtbarkeit</th><th>Mitglieder</th><th>Status</th><th>Erstellt</th></tr></thead>
          <tbody>{groups.map((g) => (
            <tr key={g.id}>
              <td><Link href={`/admin/gruppen/${g.id}`}>{g.name}</Link>{g.official && <span className="badge plan">offiziell</span>}</td>
              <td>{g.category}</td><td>{g.visibility}</td><td>{g._count.memberships}</td><td><StatusBadge status={g.status} /></td><td>{formatDate(g.createdAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager base="/admin/gruppen" params={params} page={page} total={total} />

      <section className="admin-section">
        <h2>Moderator-Bewerbungen</h2>
        {modApps.length === 0 ? <p className="muted">Keine offenen Bewerbungen.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Gruppe</th><th>Person</th><th>Motivation</th><th>Seit</th><th>Entscheidung</th></tr></thead>
            <tbody>{modApps.map((m) => (
              <tr key={m.id}>
                <td>{m.group.name}</td><td className="admin-mono">{m.userId.slice(0, 10)}…</td><td>{m.motivation}</td><td>{formatDate(m.createdAt)}</td>
                <td><div className="admin-inline">
                  <ActionForm action={modApplicationAction} submit="Ernennen" submitClass="btn small"><input type="hidden" name="applicationId" value={m.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
                  <ActionForm action={modApplicationAction} submit="Ablehnen" submitClass="btn small secondary"><input type="hidden" name="applicationId" value={m.id} /><input type="hidden" name="decision" value="reject" /></ActionForm>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="admin-section card">
        <h2>Offizielle Gruppe anlegen</h2>
        <ActionForm action={groupCreateAction} submit="Anlegen" resetOnSuccess>
          <Field label="Name" name="name" required />
          <Field label="Kategorie" name="category" required />
          <Select label="Sichtbarkeit" name="visibility" options={[{ value: "open", label: "offen" }, { value: "closed", label: "geschlossen (Beitritt auf Anfrage)" }, { value: "invite", label: "nur auf Einladung" }]} />
          <TextArea label="Beschreibung (Klartext, nicht explizit)" name="description" />
          <TextArea label="Regeln (Klartext)" name="rules" />
        </ActionForm>
      </section>
    </>
  );
}
