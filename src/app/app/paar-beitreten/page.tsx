import Link from "next/link";
import type { Metadata } from "next";
import { requireViewer } from "@/lib/viewer";
import { db } from "@/server/db";
import { sha256 } from "@/server/crypto";
import { ActionForm } from "@/components/ActionForm";
import { acceptPartnerAction } from "@/app/actions/member/profile";

export const metadata: Metadata = { title: "Paarprofil beitreten" };

export default async function PaarBeitreten({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const v = await requireViewer();
  const inv = token ? await db.coupleInvite.findUnique({ where: { tokenHash: sha256(token) } }) : null;
  const valid = !!inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  const forMe = valid && inv!.email === v.user.email;
  return (
    <div className="narrow stack">
      <h1>Paarprofil beitreten</h1>
      {!valid ? (
        <div className="alert error" role="alert">Diese Einladung ist ungültig, bereits angenommen oder abgelaufen. Bitte lass dir eine neue Einladung senden.</div>
      ) : !forMe ? (
        <div className="alert warn" role="alert">Diese Einladung gilt für eine andere E-Mail-Adresse. Bitte melde dich mit dem eingeladenen Konto an.</div>
      ) : (
        <div className="card stack">
          <p className="muted" style={{ margin: 0 }}>
            Du trittst dem gemeinsamen Profil mit deinem eigenen Login bei. Ihr teilt Profil, Nachrichten und Tokens; Ausweisdokumente bleiben getrennt. Für den Verifiziert-Status prüft jede Person ihre eigene Identität.
          </p>
          <ActionForm action={acceptPartnerAction} submit="Einladung annehmen">
            <input type="hidden" name="token" value={token} />
            <div className="field">
              <label htmlFor="displayLabel">Deine Absenderkennung (optional)</label>
              <input id="displayLabel" name="displayLabel" type="text" maxLength={20} aria-describedby="dl-hint" />
              <p className="hint" id="dl-hint">Wird bei Nachrichten als „gesendet von …“ angezeigt, z. B. ein Kürzel.</p>
            </div>
          </ActionForm>
        </div>
      )}
      <Link href="/app">Zur Startseite</Link>
    </div>
  );
}
