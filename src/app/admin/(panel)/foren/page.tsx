import Link from "next/link";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, Select, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { postHiddenAction, threadFlagAction, threadMoveAction } from "@/app/actions/admin/forums";

export default async function ForenPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("forums.manage");
  const params = await searchParams;
  const catId = sp(params, "cat");
  const threadId = sp(params, "thread");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const categories = await db.forumCategory.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], include: { group: { select: { name: true, status: true } }, _count: { select: { threads: true } } } });

  if (threadId) {
    const t = await db.thread.findUnique({ where: { id: threadId }, include: { category: true } });
    if (!t) return <Empty title="Thema nicht gefunden" />;
    const [posts, total] = await Promise.all([
      db.post.findMany({ where: { threadId }, orderBy: { createdAt: "asc" }, skip, take, include: { author: { select: { handle: true } }, revisions: { orderBy: { createdAt: "desc" } } } }),
      db.post.count({ where: { threadId } }),
    ]);
    return (
      <>
        <PageHead title={t.title}><Link href={`/admin/foren?cat=${t.categoryId}`}>← {t.category.name}</Link></PageHead>
        {posts.map((p) => (
          <article key={p.id} className="card admin-section">
            <div className="row between">
              <span className="dim">{p.official ? "eropub (offiziell)" : p.author?.handle ?? "gelöschtes Profil"} · {formatDate(p.createdAt, true)}{p.editedAt ? ` · bearbeitet ${formatDate(p.editedAt, true)}` : ""}</span>
              {p.hidden && <span className="badge unverified">ausgeblendet</span>}
            </div>
            <div className="admin-pre" style={{ marginTop: 8 }}>{p.body}</div>
            {p.revisions.length > 0 && (
              <details className="admin-details"><summary>Versionen ({p.revisions.length})</summary>
                {p.revisions.map((r) => <div key={r.id}><div className="dim">{formatDate(r.createdAt, true)}</div><div className="admin-pre">{r.body}</div></div>)}
              </details>
            )}
            <ActionForm action={postHiddenAction} submit={p.hidden ? "Wieder einblenden" : "Ausblenden"} submitClass="btn small secondary" className="admin-inline">
              <input type="hidden" name="postId" value={p.id} /><input type="hidden" name="hidden" value={p.hidden ? "false" : "true"} />
              <Field label="Grund" name="reason" required />
            </ActionForm>
          </article>
        ))}
        <Pager base="/admin/foren" params={params} page={page} total={total} />
      </>
    );
  }

  if (catId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return <Empty title="Kategorie nicht gefunden" />;
    const [threads, total] = await Promise.all([
      db.thread.findMany({ where: { categoryId: catId }, orderBy: [{ pinned: "desc" }, { lastPostAt: "desc" }], skip, take, include: { author: { select: { handle: true } }, _count: { select: { posts: true } } } }),
      db.thread.count({ where: { categoryId: catId } }),
    ]);
    return (
      <>
        <PageHead title={cat.name}><Link href="/admin/foren">← Alle Kategorien</Link></PageHead>
        {threads.length === 0 ? <Empty title="Keine Themen" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Thema</th><th>Beiträge</th><th>Letzte Aktivität</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>{threads.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/admin/foren?thread=${t.id}`}>{t.title}</Link><div className="dim">{t.official ? "offiziell" : t.author?.handle ?? "–"}</div></td>
                <td>{t._count.posts}</td><td>{formatDate(t.lastPostAt, true)}</td>
                <td>{t.pinned && <span className="badge plan">angeheftet</span>} {t.locked && <span className="badge neutral">geschlossen</span>}</td>
                <td>
                  <div className="admin-inline">
                    <ActionForm action={threadFlagAction} submit={t.pinned ? "Lösen" : "Anheften"} submitClass="btn small secondary"><input type="hidden" name="threadId" value={t.id} /><input type="hidden" name="flag" value="pinned" /><input type="hidden" name="value" value={t.pinned ? "false" : "true"} /></ActionForm>
                    <ActionForm action={threadFlagAction} submit={t.locked ? "Öffnen" : "Schließen"} submitClass="btn small secondary"><input type="hidden" name="threadId" value={t.id} /><input type="hidden" name="flag" value="locked" /><input type="hidden" name="value" value={t.locked ? "false" : "true"} /></ActionForm>
                  </div>
                  <details className="admin-details"><summary>Verschieben</summary>
                    <ActionForm action={threadMoveAction} submit="Verschieben" submitClass="btn small">
                      <input type="hidden" name="threadId" value={t.id} />
                      <Select label="Zielkategorie" name="categoryId" options={categories.filter((c) => c.id !== catId).map((c) => ({ value: c.id, label: c.group ? `${c.group.name} · ${c.name}` : c.name }))} />
                      <Field label="Grund" name="reason" required />
                    </ActionForm>
                  </details>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager base="/admin/foren" params={params} page={page} total={total} />
      </>
    );
  }

  return (
    <>
      <PageHead title="Foren">Kategorien, Themen, Beiträge. Ausblenden statt Löschen; Versionen bleiben nachvollziehbar.</PageHead>
      {categories.length === 0 ? <Empty title="Keine Kategorien" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Kategorie</th><th>Gruppe</th><th>Themen</th></tr></thead>
          <tbody>{categories.map((c) => (
            <tr key={c.id}><td><Link href={`/admin/foren?cat=${c.id}`}>{c.name}</Link></td><td>{c.group ? `${c.group.name} (${c.group.status})` : "global"}</td><td>{c._count.threads}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
