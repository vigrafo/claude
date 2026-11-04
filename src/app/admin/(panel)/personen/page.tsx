import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { adminGuard } from "../../_lib/guard";
import { PageHead, Pager, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { pageArgs } from "@/server/admin/guard";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { deletionNowAction } from "@/app/actions/admin/users";

const STATUSES = ["active", "suspended", "banned", "deleted"];
const VSTATUS = ["not_started", "in_progress", "pending_review", "verified", "rejected", "expired", "revoked"];

export default async function PersonenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await adminGuard("users.read");
  const params = await searchParams;
  const q = sp(params, "q");
  const status = sp(params, "status");
  const type = sp(params, "type");
  const ver = sp(params, "ver");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const canEmail = a.has("users.manage");

  const where: Prisma.UserWhereInput = {};
  if (status && STATUSES.includes(status)) where.status = status as Prisma.UserWhereInput["status"];
  if (ver && VSTATUS.includes(ver)) where.identityStatus = ver as Prisma.UserWhereInput["identityStatus"];
  if (type && ["single", "couple", "organizer"].includes(type)) where.memberships = { some: { status: "active", profile: { type: type as "single" } } };
  if (q) {
    where.OR = [
      { memberships: { some: { profile: { handle: { contains: q, mode: "insensitive" } } } } },
      ...(canEmail ? [{ email: { contains: q, mode: "insensitive" as const } }] : []),
      { id: q },
    ];
  }
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { memberships: { where: { status: "active" }, include: { profile: { select: { id: true, handle: true, type: true } } } } },
    }),
    db.user.count({ where }),
  ]);
  const deletions = await db.deletionRequest.findMany({ where: { status: { in: ["requested", "scheduled", "failed"] } }, orderBy: { scheduledFor: "asc" }, take: 20 });

  return (
    <>
      <PageHead title="Personen & Profile">Suche nach Pseudonym{canEmail ? " oder E-Mail" : ""}. E-Mail-Adressen sind nur mit dem Recht „users.manage“ sichtbar.</PageHead>
      <SearchBar base="/admin/personen" q={q} params={params} placeholder={canEmail ? "Pseudonym, E-Mail oder ID" : "Pseudonym oder ID"} filters={[
        { name: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "type", label: "Profiltyp", options: [{ value: "single", label: "Einzel" }, { value: "couple", label: "Paar" }, { value: "organizer", label: "Veranstalter" }] },
        { name: "ver", label: "Verifizierung", options: VSTATUS.map((s) => ({ value: s, label: s })) },
      ]} />
      {rows.length === 0 ? <Empty title="Keine Treffer" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th>{canEmail && <th>E-Mail</th>}<th>Profile</th><th>Status</th><th>Identität</th><th>Seit</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><Link href={`/admin/personen/${u.id}`} className="admin-mono">{u.id.slice(0, 10)}…</Link></td>
                  {canEmail && <td>{u.email}</td>}
                  <td>{u.memberships.map((m) => `${m.profile.handle} (${m.profile.type})`).join(", ") || "–"}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td><StatusBadge status={u.identityStatus} /></td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/personen" params={params} page={page} total={total} />

      <section className="admin-section">
        <h2>Löschanträge</h2>
        {deletions.length === 0 ? <p className="muted">Keine offenen Löschanträge.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Status</th><th>Geplant für</th><th>Fehler</th><th>Aktion</th></tr></thead>
              <tbody>
                {deletions.map((d) => (
                  <tr key={d.id}>
                    <td><Link href={`/admin/personen/${d.userId}`} className="admin-mono">{d.userId.slice(0, 10)}…</Link></td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{formatDate(d.scheduledFor, true)}</td>
                    <td>{d.error ?? "–"}</td>
                    <td>{a.has("users.manage") && ["requested", "failed"].includes(d.status) ? (
                      <ActionForm action={deletionNowAction} submit="Jetzt ausführen" submitClass="btn small danger" confirm="Löschlauf jetzt einplanen?">
                        <input type="hidden" name="requestId" value={d.id} />
                      </ActionForm>
                    ) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">„Jetzt ausführen“ setzt den Termin auf sofort. Die eigentliche Löschung übernimmt der Worker.</p>
      </section>
    </>
  );
}
