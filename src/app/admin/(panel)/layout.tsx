import Link from "next/link";
import { Logo } from "@/components/ui";
import { NavLink } from "@/components/NavLink";
import { adminGuard } from "../_lib/guard";
import { ADMIN_NAV } from "../_lib/nav";
import { adminLogoutAction } from "@/app/actions/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const a = await adminGuard();
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => a.has(i.perm)) })).filter((g) => g.items.length);
  return (
    <>
      <div className="admin-topbar">
        <div className="row"><Logo href="/admin" /><span className="badge plan">Administration</span></div>
        <div className="row">
          <span className="dim admin-mono hide-sm">{a.user.email}</span>
          <Link className="btn ghost small" href="/admin/reauth">Erneut bestätigen</Link>
          <form action={adminLogoutAction}><button className="btn secondary small" type="submit">Abmelden</button></form>
        </div>
      </div>
      <div className="admin-shell">
        <nav className="admin-side" aria-label="Adminbereiche">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="group-label">{g.group}</div>
              {g.items.map((i) => <NavLink key={i.href} href={i.href} exact={i.href === "/admin"}>{i.label}</NavLink>)}
            </div>
          ))}
        </nav>
        <main id="main" className="admin-main">{children}</main>
      </div>
    </>
  );
}
