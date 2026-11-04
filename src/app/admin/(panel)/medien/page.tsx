import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { pageArgs } from "@/server/admin/guard";
import { adminGuard } from "../../_lib/guard";
import { Field, PageHead, Pager, Reason, SearchBar, StatusBadge, sp, type SP } from "../../_lib/ui";
import { SettingForm } from "../../_lib/SettingForm";
import { formatDate, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { mediaDecideAction, mediaHoldAction } from "@/app/actions/admin/media";

export default async function MedienPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminGuard("media.moderate");
  const params = await searchParams;
  const mod = sp(params, "moderation") || "pending";
  const purpose = sp(params, "purpose");
  const hold = sp(params, "hold");
  const q = sp(params, "q");
  const { page, skip, take } = pageArgs(sp(params, "page"));
  const where: Prisma.MediaAssetWhereInput = { deletedAt: null, moderation: mod };
  if (purpose) where.purpose = purpose;
  if (hold) where.legalHold = hold === "1";
  if (q) where.owner = { handle: { contains: q, mode: "insensitive" } };
  const [rows, total] = await Promise.all([
    db.mediaAsset.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { owner: { select: { handle: true } } } }),
    db.mediaAsset.count({ where }),
  ]);
  return (
    <>
      <PageHead title="Medien">Moderationswarteschlange mit geschützter Vorschau (jeder Abruf wird protokolliert; Chatbilder nur fallbezogen). Rechtliche Sperre (Legal Hold) verhindert Löschung.</PageHead>
      <SearchBar base="/admin/medien" q={q} params={params} placeholder="Profil-Pseudonym" filters={[
        { name: "moderation", label: "Moderation", options: ["pending", "approved", "rejected"].map((s) => ({ value: s, label: s })) },
        { name: "purpose", label: "Zweck", options: ["profile", "gallery", "message", "group", "club", "gold"].map((s) => ({ value: s, label: s })) },
        { name: "hold", label: "Legal Hold", options: [{ value: "1", label: "ja" }, { value: "0", label: "nein" }] },
      ]} />
      {rows.length === 0 ? <Empty title="Keine Medien in dieser Ansicht" /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Vorschau</th><th>Hochgeladen</th><th>Profil</th><th>Zweck / Sichtbarkeit</th><th>Typ / Größe</th><th>Rechtehinweis</th><th>Status</th><th>Aktionen</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.purpose !== "message" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={`/admin/medien/${m.id}/bild`} target="_blank" rel="noopener"><img src={`/admin/medien/${m.id}/bild`} alt={`Upload von ${m.owner.handle}`} loading="lazy" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /></a>
                  ) : <span className="dim">Chatbild – nur fallbezogen</span>}
                </td>
                <td>{formatDate(m.createdAt, true)}</td>
                <td>{m.owner.handle}</td>
                <td>{m.purpose} · {m.visibility}</td>
                <td>{m.mime} · {(m.bytes / 1024).toFixed(0)} KB{m.width ? ` · ${m.width}×${m.height}` : ""}</td>
                <td>{m.rightsNote ?? "–"}</td>
                <td><StatusBadge status={m.moderation} />{m.legalHold && <span className="badge plan">Legal Hold</span>}</td>
                <td>
                  <div className="admin-inline">
                    {m.moderation !== "approved" && <ActionForm action={mediaDecideAction} submit="Freigeben" submitClass="btn small"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="decision" value="approved" /></ActionForm>}
                  </div>
                  {m.moderation !== "rejected" && (
                    <details className="admin-details"><summary>Ablehnen</summary>
                      <ActionForm action={mediaDecideAction} submit="Ablehnen" submitClass="btn small danger">
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="decision" value="rejected" />
                        <Field label="Grund" name="reason" required />
                      </ActionForm>
                    </details>
                  )}
                  <details className="admin-details"><summary>{m.legalHold ? "Legal Hold aufheben" : "Legal Hold setzen"}</summary>
                    <ActionForm action={mediaHoldAction} submit="Speichern" submitClass="btn small secondary">
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="hold" value={m.legalHold ? "false" : "true"} />
                      <Reason />
                    </ActionForm>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <Pager base="/admin/medien" params={params} page={page} total={total} />
      <SettingForm settingKey="uploads.limits" perm="media.moderate" title="Upload-Limits" labels={{ maxImageBytes: "Maximale Bildgröße (Bytes)", allowedMime: "Erlaubte Formate" }} />
    </>
  );
}
