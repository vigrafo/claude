import { db } from "@/server/db";
import { PERMISSIONS, ROLES } from "@/server/rbac";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Reason, ReauthNotice, Select } from "../../_lib/ui";
import { formatDate } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { adminSessionRevokeAction, approvalDecideAction, roleGrantAction, roleRevokeAction } from "@/app/actions/admin/roles";

export default async function RollenPage() {
  const a = await adminGuard("roles.manage");
  const [assignments, pending, sessions] = await Promise.all([
    db.roleAssignment.findMany({ where: { revokedAt: null, scopeType: null }, include: { role: true, user: { select: { email: true, mfaEnabledAt: true, status: true } } }, orderBy: { createdAt: "desc" } }),
    db.pendingApproval.findMany({ where: { kind: "role_grant", approvedBy: null, rejectedBy: null }, orderBy: { createdAt: "asc" } }),
    db.session.findMany({ where: { isAdmin: true, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const platformRoles = Object.entries(ROLES).filter(([, r]) => r.permissions.length > 0);
  const usersById = new Map(assignments.map((x) => [x.userId, x.user.email]));
  const pendingUsers = await db.user.findMany({ where: { id: { in: pending.map((p) => (p.payload as { userId: string }).userId) } }, select: { id: true, email: true } });
  const email = (id: string) => usersById.get(id) ?? pendingUsers.find((u) => u.id === id)?.email ?? id;

  return (
    <>
      <PageHead title="Rollen & Rechte">Default deny. Kritische Rollen nur per Vier-Augen-Freigabe. Eigene Rollen können nicht geändert werden. Kein Impersonation-Feature.</PageHead>
      <ReauthNotice reauthAt={a.session.reauthAt} next="/admin/rollen" />

      <section className="admin-section">
        <h2>Rollen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rolle</th><th>Kritisch</th><th>Rechte</th></tr></thead>
            <tbody>
              {Object.entries(ROLES).map(([key, r]) => (
                <tr key={key}>
                  <td><strong>{r.name}</strong><div className="dim admin-mono">{key}</div></td>
                  <td>{r.critical ? <span className="badge plan">Vier-Augen</span> : "–"}</td>
                  <td>{r.permissions.length === 0 ? <span className="muted">nur bereichsbezogen (kein Adminzugang)</span> : (
                    <div className="chips">{r.permissions.map((p) => <span key={p} className="chip" title={PERMISSIONS[p]}>{p}</span>)}</div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section card">
        <h2>Rolle vergeben</h2>
        <ActionForm action={roleGrantAction} submit="Vergeben / Antrag stellen" resetOnSuccess>
          <Field label="E-Mail-Adresse der Person" name="email" type="email" required />
          <Select label="Rolle" name="role" options={platformRoles.map(([k, r]) => ({ value: k, label: `${r.name}${r.critical ? " (kritisch)" : ""}` }))} />
          <Reason />
        </ActionForm>
      </section>

      <section className="admin-section">
        <h2>Offene Freigaben</h2>
        {pending.length === 0 ? <p className="muted">Keine offenen Anträge.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Rolle</th><th>Begründung</th><th>Beantragt von</th><th>Am</th><th>Entscheidung</th></tr></thead>
              <tbody>
                {pending.map((p) => {
                  const pl = p.payload as { userId: string; roleKey: string; reason: string };
                  return (
                    <tr key={p.id}>
                      <td>{email(pl.userId)}</td>
                      <td>{ROLES[pl.roleKey]?.name ?? pl.roleKey}</td>
                      <td>{pl.reason}</td>
                      <td>{p.requestedBy === a.user.id ? "dir" : email(p.requestedBy)}</td>
                      <td>{formatDate(p.createdAt, true)}</td>
                      <td>{p.requestedBy === a.user.id ? <span className="muted">wartet auf zweite Person</span> : (
                        <div className="admin-inline">
                          <ActionForm action={approvalDecideAction} submit="Freigeben" submitClass="btn small"><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
                          <ActionForm action={approvalDecideAction} submit="Ablehnen" submitClass="btn small secondary"><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="reject" /></ActionForm>
                        </div>
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Vergebene Plattformrollen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Rolle</th><th>MFA</th><th>Seit</th><th>Vergeben/Freigegeben</th><th>Entziehen</th></tr></thead>
            <tbody>
              {assignments.map((x) => (
                <tr key={x.id}>
                  <td>{x.user.email}</td>
                  <td>{x.role.name}</td>
                  <td>{x.user.mfaEnabledAt ? <span className="badge verified">aktiv</span> : <span className="badge unverified">fehlt</span>}</td>
                  <td>{formatDate(x.createdAt)}</td>
                  <td className="admin-mono">{x.grantedBy ? x.grantedBy.slice(0, 8) : "–"} / {x.approvedBy ? x.approvedBy.slice(0, 8) : "–"}</td>
                  <td>{x.userId === a.user.id ? <span className="muted">eigene Rolle</span> : (
                    <ActionForm action={roleRevokeAction} submit="Entziehen" submitClass="btn small danger" confirm="Rolle entziehen?">
                      <input type="hidden" name="assignmentId" value={x.id} />
                      <Reason />
                    </ActionForm>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Aktive Adminsitzungen</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Beginn</th><th>Zuletzt aktiv</th><th>Läuft ab</th><th>MFA</th><th>Re-Auth</th><th>Aktion</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.user.email}{s.id === a.session.id && <span className="badge neutral">diese Sitzung</span>}</td>
                  <td>{formatDate(s.createdAt, true)}</td>
                  <td>{formatDate(s.lastSeenAt, true)}</td>
                  <td>{formatDate(s.expiresAt, true)}</td>
                  <td>{s.mfaAt ? formatDate(s.mfaAt, true) : "–"}</td>
                  <td>{s.reauthAt ? formatDate(s.reauthAt, true) : "–"}</td>
                  <td>{s.id === a.session.id ? "–" : (
                    <ActionForm action={adminSessionRevokeAction} submit="Beenden" submitClass="btn small danger"><input type="hidden" name="sessionId" value={s.id} /></ActionForm>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
