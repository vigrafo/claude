import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { gameStats, previewEvaluation } from "@/server/admin/games";
import { pageArgs } from "@/server/admin/guard";
import { GAME_VARIANTS, resultText } from "@/domain/games";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, SearchBar, Select, StatusBadge, TextArea, sp, type SP } from "../../_lib/ui";
import { ActionForm } from "@/components/ActionForm";
import { formatDate } from "@/components/ui";
import { questionCreateAction, questionEditAction, questionStatusAction, ruleActivateAction, ruleCreateAction } from "@/app/actions/admin/games";

const VARIANTS = Object.entries(GAME_VARIANTS).map(([k, v]) => ({ value: k, label: v.title }));

export default async function SpielePage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("games.manage");
  const params = await searchParams;
  const variant = sp(params, "variant");
  const status = sp(params, "status");
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"), 20);
  const where: Prisma.GameQuestionVersionWhereInput = {};
  if (variant) where.variant = variant;
  if (status) where.status = status;
  if (q) where.OR = [{ text: { contains: q, mode: "insensitive" } }, { questionKey: q }];
  const [questions, total, rules, stats] = await Promise.all([
    db.gameQuestionVersion.findMany({ where, skip, take, orderBy: [{ variant: "asc" }, { questionKey: "asc" }, { version: "desc" }], include: { options: { orderBy: { sort: "asc" } } } }),
    db.gameQuestionVersion.count({ where }),
    db.gameRuleVersion.findMany({ orderBy: { version: "desc" } }),
    gameStats(),
  ]);
  const active = rules.find((r) => r.active);
  const ta = sp(params, "a");
  const tb = sp(params, "b");
  const preview = ta || tb ? previewEvaluation(active ?? { roundSize: 10, minAnswered: 8, thresholdBp: 8000 }, ta, tb) : null;

  return (
    <>
      <PageHead title="Spiele">Fragenkatalog, Regelversionen, Testauswertung und aggregierte Statistik. Einzelne Antworten sind hier nicht einsehbar.</PageHead>

      <section className="admin-section">
        <h2>Statistik (aggregiert)</h2>
        <div className="grid grid-4">
          {stats.byStatus.map((s) => <div key={s.status} className="card tight"><div className="dim">{s.status}</div><div className="kpi">{s.count}</div></div>)}
          <div className="card tight"><div className="dim">Ausgewertet</div><div className="kpi">{stats.evaluated}</div></div>
          <div className="card tight"><div className="dim">Match-Quote</div><div className="kpi">{stats.matchRate == null ? "–" : `${Math.round(stats.matchRate * 100)} %`}</div></div>
        </div>
      </section>

      <section className="admin-section">
        <h2>Fragenkatalog</h2>
        <SearchBar base="/admin/spiele" q={q} params={params} filters={[
          { name: "variant", label: "Variante", options: VARIANTS },
          { name: "status", label: "Status", options: ["draft", "approved", "archived"].map((s) => ({ value: s, label: s })) },
        ]} />
        <div className="table-wrap"><table>
          <thead><tr><th>Frage</th><th>Variante</th><th>Version</th><th>Status</th><th>Optionen</th><th>Aktionen</th></tr></thead>
          <tbody>
            {questions.map((qq) => (
              <tr key={qq.id}>
                <td>{qq.text}<div className="dim admin-mono">{qq.questionKey} · {qq.category}</div></td>
                <td>{GAME_VARIANTS[qq.variant as keyof typeof GAME_VARIANTS]?.title ?? qq.variant}</td>
                <td>v{qq.version}</td>
                <td><StatusBadge status={qq.status} /></td>
                <td>{qq.options.map((o) => o.label).join(" · ")}</td>
                <td>
                  <div className="admin-inline">
                    {qq.status === "draft" && <ActionForm action={questionStatusAction} submit="Freigeben" submitClass="btn small"><input type="hidden" name="id" value={qq.id} /><input type="hidden" name="op" value="approve" /></ActionForm>}
                    {qq.status !== "archived" && <ActionForm action={questionStatusAction} submit="Archivieren" submitClass="btn small secondary"><input type="hidden" name="id" value={qq.id} /><input type="hidden" name="op" value="archive" /></ActionForm>}
                  </div>
                  <details className="admin-details">
                    <summary>Bearbeiten (neue Version)</summary>
                    <ActionForm action={questionEditAction} submit="Neue Version anlegen">
                      <input type="hidden" name="id" value={qq.id} />
                      <Field label="Kategorie" name="category" defaultValue={qq.category} />
                      <Field label="Frage" name="text" defaultValue={qq.text} />
                      <TextArea label="Optionen (eine pro Zeile; „Nicht mein Thema“ wird automatisch ergänzt)" name="options" defaultValue={qq.options.filter((o) => !o.neutral).map((o) => o.label).join("\n")} />
                    </ActionForm>
                  </details>
                </td>
              </tr>
            ))}
            {questions.length === 0 && <tr><td colSpan={6} className="muted">Keine Fragen.</td></tr>}
          </tbody>
        </table></div>
        <Pager base="/admin/spiele" params={params} page={page} total={total} size={20} />
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Neue Frage</h3>
          <ActionForm action={questionCreateAction} submit="Als Entwurf anlegen" resetOnSuccess>
            <Select label="Variante" name="variant" options={VARIANTS} />
            <Field label="Kategorie" name="category" required />
            <Field label="Frage (nicht explizit)" name="text" required />
            <TextArea label="Optionen (eine pro Zeile, 2–6)" name="options" />
          </ActionForm>
        </div>
      </section>

      <section className="admin-section">
        <h2>Regelversionen</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Version</th><th>Fragen/Runde</th><th>Min. beantwortet</th><th>Schwelle</th><th>Einladungen/Tag</th><th>Ablauf</th><th>Erstellt</th><th>Status</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>v{r.version}</td><td>{r.roundSize}</td><td>{r.minAnswered}</td><td>{(r.thresholdBp / 100).toFixed(2)} %</td><td>{r.inviteLimitPerDay}</td><td>{r.expiresHours} h</td><td>{formatDate(r.createdAt)}</td>
                <td>{r.active ? <span className="badge verified">aktiv</span> : (
                  <ActionForm action={ruleActivateAction} submit="Aktivieren" submitClass="btn small secondary" confirm="Diese Regelversion aktivieren?"><input type="hidden" name="id" value={r.id} /></ActionForm>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Neue Regelversion</h3>
          <ActionForm action={ruleCreateAction} submit="Anlegen (inaktiv)">
            <Field label="Fragen je Runde" name="roundSize" type="number" defaultValue={active?.roundSize ?? 10} />
            <Field label="Mindestens von beiden beantwortet" name="minAnswered" type="number" defaultValue={active?.minAnswered ?? 8} />
            <Field label="Schwelle (Basispunkte, 8000 = 80 %)" name="thresholdBp" type="number" defaultValue={active?.thresholdBp ?? 8000} />
            <Field label="Einladungen pro Tag" name="inviteLimitPerDay" type="number" defaultValue={active?.inviteLimitPerDay ?? 5} />
            <Field label="Ablauf (Stunden)" name="expiresHours" type="number" defaultValue={active?.expiresHours ?? 168} />
          </ActionForm>
        </div>
      </section>

      <section className="admin-section card">
        <h2>Testauswertung (ohne Speicherung)</h2>
        <p className="muted">Künstliche Antworten je Paar als Optionsschlüssel, getrennt durch Leerzeichen (z. B. „o1 o2 o1“). „-“ = übersprungen, „n“ = „Nicht mein Thema“. Es gilt die aktive Regelversion.</p>
        <form method="get" className="stack">
          <div className="field"><label htmlFor="ta">Paar A</label><input id="ta" name="a" defaultValue={ta} /></div>
          <div className="field"><label htmlFor="tb">Paar B</label><input id="tb" name="b" defaultValue={tb} /></div>
          <button className="btn secondary" type="submit">Auswerten</button>
        </form>
        {preview && (
          <div className="alert info" role="status" style={{ marginTop: 12 }}>
            <strong>{preview.status}</strong> · beantwortet von beiden: {preview.answeredBoth} · Treffer: {preview.hits} · benötigt: {preview.requiredHits}
            <div>{resultText(preview)}</div>
          </div>
        )}
      </section>
    </>
  );
}
