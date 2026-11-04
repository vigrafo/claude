import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { adminGuard } from "../../../_lib/guard";
import { Field, PageHead, Reason, Select, StatusBadge, TextArea } from "../../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { groupDecideAction, groupSettingsAction, modRevokeAction } from "@/app/actions/admin/groups";

export default async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  await adminGuard("groups.manage");
  const { id } = await params;
  const g = await db.group.findUnique({ where: { id }, include: { applications: { orderBy: { createdAt: "desc" } }, _count: { select: { memberships: { where: { status: "active" } } } } } });
  if (!g) notFound();
  const mods = await db.roleAssignment.findMany({ where: { scopeType: "group", scopeId: g.id, revokedAt: null, role: { key: "group_moderator" } } });
  return (
    <>
      <PageHead title={g.name}><Link href="/admin/gruppen">← Zur Liste</Link></PageHead>
      <section className="card">
        <dl className="admin-kv">
          <dt>Status</dt><dd><StatusBadge status={g.status} />{g.official && <span className="badge plan">offiziell</span>}</dd>
          <dt>Kategorie / Region</dt><dd>{g.category} · {g.regionCountry ?? "–"} {g.regionName ?? ""}</dd>
          <dt>Mitglieder</dt><dd>{g._count.memberships}</dd>
          <dt>Erstellt</dt><dd>{formatDate(g.createdAt, true)}</dd>
          <dt>Letzte Entscheidung</dt><dd>{g.decisionNote ?? "–"}</dd>
          <dt>Antrag</dt><dd>{g.applications[0] ? `${g.applications[0].status} · vorgeschlagene Moderatoren: ${g.applications[0].proposedModerators.join(", ") || "–"} · ${g.applications[0].note ?? ""}` : "–"}</dd>
        </dl>
      </section>
      <section className="admin-section card">
        <h2>Entscheidung</h2>
        <ActionForm action={groupDecideAction} submit="Speichern" confirm="Status der Gruppe ändern?">
          <input type="hidden" name="groupId" value={g.id} />
          <Select label="Neuer Status" name="status" options={[{ value: "approved", label: "freigeben" }, { value: "rejected", label: "ablehnen" }, { value: "suspended", label: "sperren" }, { value: "archived", label: "archivieren" }]} />
          <Field label="Begründung (Pflicht außer bei Freigabe)" name="note" />
        </ActionForm>
      </section>
      <section className="admin-section card">
        <h2>Regeln & Sichtbarkeit</h2>
        <ActionForm action={groupSettingsAction} submit="Speichern">
          <input type="hidden" name="groupId" value={g.id} />
          <Select label="Sichtbarkeit" name="visibility" defaultValue={g.visibility} options={[{ value: "open", label: "offen" }, { value: "closed", label: "geschlossen" }, { value: "invite", label: "nur auf Einladung" }]} />
          <TextArea label="Beschreibung" name="description" defaultValue={g.description} />
          <TextArea label="Regeln (Klartext)" name="rules" defaultValue={g.rules ?? ""} />
        </ActionForm>
      </section>
      <section className="admin-section">
        <h2>Moderatoren</h2>
        {mods.length === 0 ? <p className="muted">Keine ernannten Moderatoren.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Person</th><th>Seit</th><th>Entziehen</th></tr></thead>
            <tbody>{mods.map((m) => (
              <tr key={m.id}><td className="admin-mono">{m.userId}</td><td>{formatDate(m.createdAt)}</td>
                <td><ActionForm action={modRevokeAction} submit="Entziehen" submitClass="btn small danger"><input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="userId" value={m.userId} /><Reason /></ActionForm></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
