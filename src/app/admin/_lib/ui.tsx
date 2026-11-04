import Link from "next/link";
import { reauthFresh } from "@/server/admin/guard";

export type SP = Record<string, string | string[] | undefined>;

export function sp(params: SP, key: string): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="admin-head">
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}

/** Pagination über ?page= – übrige Parameter bleiben erhalten. */
export function Pager({ base, params, page, total, size = 25 }: { base: string; params: SP; page: number; total: number; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="dim admin-count">{total} Einträge</p>;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== "page" && typeof v === "string" && v) q.set(k, v);
    q.set("page", String(p));
    return `${base}?${q.toString()}`;
  };
  return (
    <nav className="row admin-pager" aria-label="Seiten">
      {page > 1 ? <Link className="btn small secondary" href={href(page - 1)}>Zurück</Link> : <span />}
      <span className="dim">Seite {page} von {pages} · {total} Einträge</span>
      {page < pages ? <Link className="btn small secondary" href={href(page + 1)}>Weiter</Link> : <span />}
    </nav>
  );
}

/** Einfache GET-Suche mit optionalen Filtern (Select). */
export function SearchBar({
  base, q, placeholder = "Suchen …", filters = [], params = {}, noQuery = false,
}: {
  base: string; q?: string; placeholder?: string; params?: SP; noQuery?: boolean;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
}) {
  return (
    <form method="get" action={base} className="admin-search row" role="search">
      {!noQuery && (
        <div className="field">
          <label htmlFor="q" className="sr-only">Suche</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={placeholder} />
        </div>
      )}
      {filters.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={`f-${f.name}`} className="sr-only">{f.label}</label>
          <select id={`f-${f.name}`} name={f.name} defaultValue={sp(params, f.name)}>
            <option value="">{f.label}: alle</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}
      <button className="btn small" type="submit">Anwenden</button>
    </form>
  );
}

export function ReauthNotice({ reauthAt, next }: { reauthAt: Date | null; next: string }) {
  if (reauthFresh(reauthAt)) return <p className="alert ok">Re-Authentifizierung aktiv – sensible Aktionen sind freigeschaltet.</p>;
  return (
    <p className="alert warn">
      Sensible Aktionen auf dieser Seite verlangen eine frische Bestätigung.{" "}
      <Link href={`/admin/reauth?next=${encodeURIComponent(next)}`}>Erneut bestätigen</Link>
    </p>
  );
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

export function Field({ label, name, type = "text", defaultValue, required, hint, ...rest }: {
  label: string; name: string; type?: string; defaultValue?: string | number; required?: boolean; hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "defaultValue">) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === "checkbox") {
    return (
      <div className="field">
        <label className="check" htmlFor={id}>
          <input id={id} type="checkbox" name={name} defaultChecked={!!defaultValue} {...rest} /> {label}
        </label>
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue} required={required} {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, defaultValue, hint, rows = 4, required }: { label: string; name: string; defaultValue?: string; hint?: string; rows?: number; required?: boolean }) {
  const id = `t-${name}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} defaultValue={defaultValue} rows={rows} required={required} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Select({ label, name, options, defaultValue }: { label: string; name: string; options: (string | { value: string; label: string })[]; defaultValue?: string }) {
  const id = `s-${name}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue}>
        {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

export function Reason({ label = "Begründung", name = "reason", min = 5 }: { label?: string; name?: string; min?: number }) {
  return <Field label={label} name={name} required minLength={min} hint={`Pflichtfeld, mind. ${min} Zeichen – wird im Audit-Protokoll gespeichert.`} />;
}

export function money(cents: number | null | undefined, currency = "EUR") {
  if (cents == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export function StatusBadge({ status }: { status: string }) {
  const ok = ["approved", "verified", "active", "paid", "published", "done", "processed", "sent", "redeemed", "resolved", "closed"].includes(status);
  const warn = ["pending", "pending_review", "pending_approval", "review", "in_review", "open", "scheduled", "reserved", "awaiting_provider", "requested", "appealed", "draft", "waitlist", "in_progress"].includes(status);
  return <span className={`badge ${ok ? "verified" : warn ? "unverified" : "neutral"}`}>{status}</span>;
}

export function Kpi({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <div className="dim">{label}</div>
      <div className="kpi">{value}</div>
    </>
  );
  return href ? <Link href={href} className="card card-link tight">{inner}</Link> : <div className="card tight">{inner}</div>;
}
