import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, SearchBar, sp, type SP } from "../../_lib/ui";
import { SettingForm } from "../../_lib/SettingForm";
import { ActionForm } from "@/components/ActionForm";
import { interestCreateAction, interestUpdateAction } from "@/app/actions/admin/matching";

export default async function MatchingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("matching.manage");
  const params = await searchParams;
  const q = sp(params, "q");
  const active = sp(params, "active");
  const { page, skip, take } = pageArgs(sp(params, "page"), 50);
  const where: Prisma.InterestWhereInput = {};
  if (q) where.OR = [{ label: { contains: q, mode: "insensitive" } }, { slug: { contains: q } }, { category: { contains: q, mode: "insensitive" } }];
  if (active) where.active = active === "1";
  const [rows, total] = await Promise.all([
    db.interest.findMany({ where, skip, take, orderBy: [{ category: "asc" }, { label: "asc" }], include: { _count: { select: { profiles: true } } } }),
    db.interest.count({ where }),
  ]);
  return (
    <>
      <PageHead title="Matching">Interessen-Taxonomie, Gewichtungen und Kontaktlimits. Inhalte bleiben nicht explizit.</PageHead>
      <section className="admin-section">
        <h2>Interessen</h2>
        <SearchBar base="/admin/matching" q={q} params={params} filters={[{ name: "active", label: "Status", options: [{ value: "1", label: "aktiv" }, { value: "0", label: "inaktiv" }] }]} />
        <div className="table-wrap"><table>
          <thead><tr><th>Bezeichnung / Kategorie</th><th>Kennung</th><th>Profile</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <ActionForm action={interestUpdateAction} submit="Speichern" submitClass="btn small secondary" className="admin-inline">
                    <input type="hidden" name="id" value={i.id} />
                    <Field label="Bezeichnung" name="label" defaultValue={i.label} />
                    <Field label="Kategorie" name="category" defaultValue={i.category} />
                  </ActionForm>
                </td>
                <td className="admin-mono">{i.slug}</td>
                <td>{i._count.profiles}</td>
                <td>
                  <ActionForm action={interestUpdateAction} submit={i.active ? "Deaktivieren" : "Aktivieren"} submitClass="btn small secondary">
                    <input type="hidden" name="id" value={i.id} /><input type="hidden" name="active" value={i.active ? "false" : "true"} />
                  </ActionForm>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">Keine Interessen gefunden.</td></tr>}
          </tbody>
        </table></div>
        <Pager base="/admin/matching" params={params} page={page} total={total} size={50} />
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Neues Interesse</h3>
          <ActionForm action={interestCreateAction} submit="Anlegen" resetOnSuccess>
            <Field label="Kennung (a–z, 0–9, -)" name="slug" required />
            <Field label="Bezeichnung" name="label" required />
            <Field label="Kategorie" name="category" required />
          </ActionForm>
        </div>
      </section>
      <SettingForm settingKey="matching.weights" perm="matching.manage" title="Matching-Gewichtungen (0–10)" labels={{ interests: "Gemeinsame Interessen", lookingFor: "Gesucht wird", distance: "Entfernung", activity: "Aktivität", verified: "Verifiziert" }} />
      <SettingForm settingKey="ratelimits" perm="matching.manage" title="Kontakt- & Ratenlimits" labels={{ contactRequestsPerDay: "Kontaktanfragen pro Tag", messagesPerMinute: "Nachrichten pro Minute", registrationsPerHourPerIp: "Registrierungen pro Stunde/IP", contactFormPerHourPerIp: "Kontaktformular pro Stunde/IP" }} />
    </>
  );
}
