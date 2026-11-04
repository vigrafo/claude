import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { GOLD_KINDS, GOLD_TRANSITIONS, type GoldStatus } from "@/server/admin/content";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Select, StatusBadge, TextArea } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { goldSaveAction, goldTransitionAction } from "@/app/actions/admin/content";

const LABEL: Record<GoldStatus, string> = { draft: "Zurück in Entwurf", review: "Zur Prüfung", scheduled: "Planen", published: "Jetzt veröffentlichen", archived: "Archivieren", withdrawn: "Zurückziehen" };

export default async function GoldDetail({ params }: { params: Promise<{ id: string }> }) {
  await adminGuard("content.manage");
  const { id } = await params;
  const c = await db.goldContent.findUnique({ where: { id }, include: { revisions: { orderBy: { version: "desc" }, take: 20 } } });
  if (!c) notFound();
  const next = GOLD_TRANSITIONS[c.status as GoldStatus] ?? [];
  return (
    <>
      <PageHead title={c.title}><Link href="/admin/gold">← Zur Liste</Link></PageHead>
      <section className="card admin-section">
        <div className="row"><StatusBadge status={c.status} /><span className="badge neutral">v{c.version}</span>{c.publishAt && <span className="dim">Veröffentlichung: {formatDate(c.publishAt, true)}</span>}</div>
        {!c.rightsProof && <p className="alert warn">Kein Rechtenachweis hinterlegt – Veröffentlichung/Planung ist gesperrt.</p>}
        <div className="row" style={{ marginTop: 12 }}>
          {next.map((to) => (
            <ActionForm key={to} action={goldTransitionAction} submit={LABEL[to]} submitClass={to === "published" ? "btn small" : "btn small secondary"} className="admin-inline">
              <input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value={to} />
              {to === "scheduled" && <Field label="Veröffentlichen am" name="publishAt" type="datetime-local" required />}
            </ActionForm>
          ))}
        </div>
      </section>
      <div className="grid grid-2">
        <section className="card">
          <h2>Bearbeiten</h2>
          <ActionForm action={goldSaveAction} submit="Speichern (neue Revision)">
            <input type="hidden" name="id" value={c.id} />
            <Field label="Kennung" name="slug" defaultValue={c.slug} />
            <Field label="Titel" name="title" defaultValue={c.title} />
            <Select label="Art" name="kind" defaultValue={c.kind} options={GOLD_KINDS.map((k) => k)} />
            <Field label="Kategorie" name="category" defaultValue={c.category} />
            <TextArea label="Kurzfassung" name="summary" defaultValue={c.summary} rows={2} />
            <TextArea label="Inhalt (Klartext)" name="body" defaultValue={c.body} rows={12} />
            <Field label="Rechtenachweis" name="rightsProof" defaultValue={c.rightsProof ?? ""} />
            <Field label="Medienschlüssel (optional)" name="mediaKey" defaultValue={c.mediaKey ?? ""} />
          </ActionForm>
        </section>
        <section className="card">
          <h2>Vorschau</h2>
          <p className="eyebrow">{c.kind} · {c.category}</p>
          <h3>{c.title}</h3>
          <p className="muted">{c.summary}</p>
          <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
        </section>
      </div>
      <section className="admin-section">
        <h2>Revisionen</h2>
        {c.revisions.map((r) => (
          <details key={r.id} className="admin-details"><summary>v{r.version} · {formatDate(r.createdAt, true)} · {r.title}</summary><div className="admin-pre">{r.body}</div></details>
        ))}
      </section>
    </>
  );
}
