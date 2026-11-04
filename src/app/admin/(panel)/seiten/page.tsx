import { db } from "@/server/db";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, TextArea, sp, type SP } from "../../_lib/ui";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { pageSaveAction } from "@/app/actions/admin/content";
import Link from "next/link";

export default async function SeitenPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("content.manage");
  const params = await searchParams;
  const sel = sp(params, "id");
  const pages = await db.publicPage.findMany({ orderBy: { slug: "asc" } });
  const p = pages.find((x) => x.id === sel);
  return (
    <>
      <PageHead title="Öffentliche Seiten">Nur Klartext – HTML und Skripte werden abgewiesen. Rechtstexte vor Livebetrieb juristisch prüfen lassen.</PageHead>
      {pages.length === 0 ? <Empty title="Keine Seiten" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Seite</th><th>Pfad</th><th>Navigation</th><th>Geändert</th></tr></thead>
          <tbody>{pages.map((x) => (
            <tr key={x.id}><td><Link href={`/admin/seiten?id=${x.id}`}>{x.title}</Link></td><td className="admin-mono">/seite/{x.slug}</td><td>{x.navOrder ?? "–"}</td><td>{formatDate(x.updatedAt, true)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {p && (
        <section className="admin-section card">
          <h2>{p.title} bearbeiten</h2>
          <ActionForm action={pageSaveAction} submit="Speichern">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Titel" name="title" defaultValue={p.title} />
            <Field label="Reihenfolge in Navigation (optional, 0–99)" name="navOrder" type="number" defaultValue={p.navOrder ?? ""} />
            <TextArea label="Text (Klartext)" name="body" defaultValue={p.body} rows={16} />
          </ActionForm>
        </section>
      )}
    </>
  );
}
