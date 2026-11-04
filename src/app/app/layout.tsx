import Link from "next/link";
import { Logo, Icon, VerifiedBadge } from "@/components/ui";
import { NavLink } from "@/components/NavLink";
import { requireViewer } from "@/lib/viewer";
import { logoutAction } from "@/app/actions/auth";
import { db } from "@/server/db";
import { maintenanceScreen } from "@/components/Maintenance";

export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const m = await maintenanceScreen();
  if (m) return m;
  const v = await requireViewer();
  const unread = v.profileRow
    ? await db.messageRequest.count({ where: { toProfileId: v.profileRow.id, status: "pending" } })
    : 0;
  const notes = await db.notification.count({ where: { userId: v.user.id, readAt: null } });
  return (
    <>
      <header className="site-header">
        <div className="container bar">
          <Logo href="/app" />
          <nav className="topnav member" aria-label="Mitgliederbereich">
            <NavLink href="/app/entdecken">Entdecken</NavLink>
            <NavLink href="/app/nachrichten">Nachrichten{unread > 0 && <span className="badge-count">{unread}</span>}</NavLink>
            <NavLink href="/app/community">Community</NavLink>
            <NavLink href="/app/events">Events</NavLink>
            <NavLink href="/app/spiele">Spiele</NavLink>
            <NavLink href="/app/profil">Profil</NavLink>
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/app/benachrichtigungen" className="btn ghost small" aria-label={`Benachrichtigungen, ${notes} ungelesen`}>
              🔔{notes > 0 && <span className="badge-count">{notes}</span>}
            </Link>
            {v.profileRow && <span className="hide-sm"><VerifiedBadge verified={v.verified} /></span>}
            <form action={logoutAction}><button className="btn ghost small" type="submit">Abmelden</button></form>
          </div>
        </div>
      </header>
      <main id="main" className="member-main container" style={{ paddingTop: 24 }}>{children}</main>
      <nav className="bottomnav" aria-label="Hauptnavigation mobil">
        <NavLink href="/app/entdecken"><Icon name="discover" />Entdecken</NavLink>
        <NavLink href="/app/nachrichten"><Icon name="messages" />Nachrichten</NavLink>
        <NavLink href="/app/community"><Icon name="community" />Community</NavLink>
        <NavLink href="/app/events"><Icon name="events" />Events</NavLink>
        <NavLink href="/app/profil"><Icon name="profile" />Profil</NavLink>
      </nav>
    </>
  );
}
