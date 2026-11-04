import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { GOLD_KINDS, GOLD_STATUSES } from "@/server/admin/content";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, SearchBar, Select, StatusBadge, TextArea, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { goldCreateAction } from "@/app/actions/admin/content";

export default async function GoldPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("content.manage");
  const params = await searchParams;
  const q = sp(params, "q");
  const status = sp(params, "status");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.GoldContentWhereInput = {};
  if (status) where.status = status;
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q } }];
  const [rows, total] = await Promise.all([db.goldContent.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }), db.goldContent.count({ where })]);
  return (
    <>
      <PageHead title="Gold-CMS">Redaktionelle Gold-Inhalte (nicht explizit). Workflow: Entwurf → Prüfung → geplant/veröffentlicht → archiviert/zurückgezogen. Veröffentlichung nur mit Rechtenachweis.</PageHead>
      <SearchBar base="/admin/gold" q={q} params={params} filters={[{ name: "status", label: "Status", options: GOLD_STATUSES.map((s) => ({ value: s, label: s })) }]} />
      {rows.length === 0 ? <Empty title="Noch keine Inhalte" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Titel</th><th>Art</th><th>Status</th><th>Version</th><th>Veröffentlichung</th><th>Geändert</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id}><td><Link href={`/admin/gold/${c.id}`}>{c.title}</Link><div className="dim admin-mono">{c.slug}</div></td><td>{c.kind}</td><td><StatusBadge status={c.status} /></td><td>v{c.version}</td><td>{formatDate(c.publishAt, true)}</td><td>{formatDate(c.updatedAt, true)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Pager base="/admin/gold" params={params} page={page} total={total} />
      <section className="admin-section card">
        <h2>Neuer Inhalt</h2>
        <ActionForm action={goldCreateAction} submit="Als Entwurf anlegen">
          <Field label="Kennung (URL, a–z, 0–9, -)" name="slug" required />
          <Field label="Titel" name="title" required />
          <Select label="Art" name="kind" options={GOLD_KINDS.map((k) => k)} />
          <Field label="Kategorie" name="category" required />
          <TextArea label="Kurzfassung" name="summary" rows={2} />
          <TextArea label="Inhalt (Klartext, kein HTML)" name="body" rows={8} />
          <Field label="Rechtenachweis (Bild-/Text-/Personenrechte)" name="rightsProof" hint="Pflicht vor Veröffentlichung, z. B. Lizenz-/Vertragsreferenz." />
        </ActionForm>
      </section>
    </>
  );
}
