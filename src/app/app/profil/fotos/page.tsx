import type { Metadata } from "next";
import Link from "next/link";
import { actingProfile } from "@/app/app/_lib/server";
import { listOwnMedia, GALLERY_LIMIT } from "@/server/uploads";
import { getSetting } from "@/server/settings";
import { ActionForm } from "@/components/ActionForm";
import { HiddenForm } from "@/app/app/_components/forms";
import { Empty, formatDate } from "@/components/ui";
import { deletePhotoAction, setPhotoVisibilityAction, uploadPhotoAction } from "@/app/actions/member/media";

export const metadata: Metadata = { title: "Fotos" };
export const dynamic = "force-dynamic";

const VIS_LABEL: Record<string, string> = {
  private: "Nur ich",
  contacts: "Bestätigte Kontakte",
  verified_members: "Verifizierte Mitglieder",
};
const MOD_LABEL: Record<string, [string, string]> = {
  pending: ["In Prüfung", "neutral"],
  approved: ["Freigegeben", "verified"],
  rejected: ["Abgelehnt", "unverified"],
};

export default async function Fotos() {
  const { userId, profileId } = await actingProfile();
  const [media, limits] = await Promise.all([listOwnMedia(userId, profileId), getSetting("uploads.limits")]);
  const gallery = media.filter((m) => m.purpose === "gallery");
  return (
    <div className="stack" style={{ maxWidth: 960 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Fotos</h1>
        <Link className="btn ghost small" href="/app/profil">Zurück zum Profil</Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Du entscheidest, wer welches Bild sieht. Beim Hochladen entfernen wir automatisch alle Metadaten (z. B. Standort, Kamera, Datum).
        Jedes Bild wird vor der Freigabe geprüft. Bitte keine expliziten Darstellungen, keine Bilder anderer Personen ohne deren Einverständnis
        und keine erkennbaren Ausweisdokumente.
      </p>

      <section className="card" aria-labelledby="up-h">
        <h2 id="up-h">Bild hochladen</h2>
        <ActionForm action={uploadPhotoAction} submit="Hochladen" resetOnSuccess>
          <div className="grid grid-3">
            <div className="field">
              <label htmlFor="file">Bilddatei</label>
              <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="file-hint" />
              <p className="hint" id="file-hint">JPEG, PNG oder WebP, höchstens {Math.round(limits.maxImageBytes / 1_000_000)} MB.</p>
            </div>
            <div className="field">
              <label htmlFor="purpose">Verwendung</label>
              <select id="purpose" name="purpose" defaultValue="gallery">
                <option value="profile">Profilbild</option>
                <option value="gallery">Galerie ({gallery.length}/{GALLERY_LIMIT})</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="visibility">Wer darf es sehen?</label>
              <select id="visibility" name="visibility" defaultValue="contacts">
                <option value="contacts">Bestätigte Kontakte</option>
                <option value="verified_members">Verifizierte Mitglieder</option>
                <option value="private">Nur ich (nur Galerie)</option>
              </select>
            </div>
          </div>
          <label className="check field">
            <input type="checkbox" name="rights" required />
            Ich habe die Rechte an diesem Bild. Alle erkennbaren Personen sind volljährig und mit der Veröffentlichung einverstanden.
          </label>
        </ActionForm>
      </section>

      <section aria-labelledby="mine-h" className="stack">
        <h2 id="mine-h">Deine Bilder</h2>
        {media.length === 0 ? (
          <Empty title="Noch keine Bilder">Ein Profilbild hilft anderen, dich wiederzuerkennen – du bestimmst, wer es sieht.</Empty>
        ) : (
          <div className="photo-grid">
            {media.map((m) => {
              const [modText, modCls] = MOD_LABEL[m.moderation] ?? [m.moderation, "neutral"];
              return (
                <figure key={m.id} className="card tight">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/app/medien/${m.id}`} alt={m.purpose === "profile" ? "Dein Profilbild" : "Dein Galeriebild"} loading="lazy" />
                  <figcaption className="stack" style={{ gap: 6 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <span className={`badge ${modCls}`}>{modText}</span>
                      <span className="badge neutral">{m.purpose === "profile" ? "Profilbild" : "Galerie"}</span>
                    </span>
                    <span>{formatDate(m.createdAt)} · {VIS_LABEL[m.visibility] ?? m.visibility}</span>
                    <ActionForm action={setPhotoVisibilityAction} submit="Freigabe ändern" submitClass="btn ghost small">
                      <input type="hidden" name="id" value={m.id} />
                      <label className="sr-only" htmlFor={`vis-${m.id}`}>Sichtbarkeit</label>
                      <select id={`vis-${m.id}`} name="visibility" defaultValue={m.visibility}>
                        <option value="contacts">Bestätigte Kontakte</option>
                        <option value="verified_members">Verifizierte Mitglieder</option>
                        {m.purpose === "gallery" && <option value="private">Nur ich</option>}
                      </select>
                    </ActionForm>
                    <HiddenForm action={deletePhotoAction} fields={{ id: m.id }} submit="Löschen" submitClass="btn danger small" confirm="Dieses Bild endgültig löschen?" />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
