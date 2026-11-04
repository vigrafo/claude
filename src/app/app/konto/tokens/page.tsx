import Link from "next/link";
import type { Metadata } from "next";
import { actingProfile, enabledPaymentProvider } from "@/app/app/_lib/server";
import { db } from "@/server/db";
import { HiddenForm } from "@/app/app/_components/forms";
import { buyTokensAction } from "@/app/actions/member/account";
import { formatCents } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Tokens kaufen" };

export default async function Tokens() {
  const { profileId, v } = await actingProfile();
  const [rows, provider, debt] = await Promise.all([
    db.tokenPackageVersion.findMany({ where: { active: true }, orderBy: [{ key: "asc" }, { version: "desc" }] }),
    enabledPaymentProvider(),
    db.tokenDebt.count({ where: { profileId, settledAt: null } }),
  ]);
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.key)) latest.set(r.key, r);
  const pkgs = [...latest.values()].sort((a, b) => a.tokens - b.tokens);
  const send = v.can("send_message");
  return (
    <div className="stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Tokens kaufen</h1>
        <Link className="btn ghost small" href="/app/konto">Zum Konto</Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Aktuelles Guthaben: <strong>{v.profileRow.tokenBalance}</strong> Tokens für {v.profileRow.handle}.{" "}
        {send.tokenCostPerMessage ? `In deinem Tarif kostet eine Nachricht ${send.tokenCostPerMessage} Token; Geschenke kosten zusätzlich.` : "Mit deinem Tarif schreibst du ohne Tokenkosten – Tokens brauchst du nur für virtuelle Geschenke."}
        {" "}Lesen und Empfangen ist immer kostenlos. Tokens verfallen nicht und gehören zum Profil{v.profileRow.type === "couple" ? " (gemeinsam für euch beide)" : ""}.
      </p>
      {debt > 0 && <p className="alert warn">Wegen einer offenen Rückbuchung sind Käufe vorübergehend gesperrt. Bitte wende dich an den <Link href="/kontakt">Support</Link>.</p>}
      {!provider && <p className="alert warn">Derzeit ist keine Zahlungsart verfügbar. Bitte versuche es später erneut.</p>}
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Tokenpakete im Vergleich</caption>
          <thead><tr><th scope="col">Paket</th><th scope="col">Preis</th><th scope="col">Preis je Token</th><th scope="col">Entspricht</th><th scope="col"><span className="sr-only">Kaufen</span></th></tr></thead>
          <tbody>
            {pkgs.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.tokens} Tokens</th>
                <td>{formatCents(p.priceCents, p.currency)}</td>
                <td>{formatCents(Math.round(p.priceCents / p.tokens), p.currency)}</td>
                <td>{p.tokens} Nachrichten mit Basis</td>
                <td>{provider && !debt ? <HiddenForm action={buyTokensAction} fields={{ packageKey: p.key }} submit="Kaufen" submitClass="btn small" /> : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Preise inkl. USt. Zum Vergleich: Premium enthält Nachrichten ohne Tokenkosten. <Link href="/app/konto/tarif">Tarife ansehen</Link></p>
    </div>
  );
}
