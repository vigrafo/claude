import Link from "next/link";
import type { Metadata } from "next";
import { actingUser } from "@/app/app/_lib/server";
import { listNotifications } from "@/server/notifications";
import { Empty, formatDate } from "@/components/ui";
import { HiddenForm } from "@/app/app/_components/forms";
import { markNotificationAction } from "@/app/actions/member/account";
import { memberLink } from "@/app/app/_lib/options";

export const metadata: Metadata = { title: "Benachrichtigungen" };

export default async function Benachrichtigungen() {
  const { userId } = await actingUser();
  const items = await listNotifications(userId);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Benachrichtigungen</h1>
        {unread > 0 && <HiddenForm action={markNotificationAction} fields={{ id: "" }} submit="Alle als gelesen markieren" />}
      </div>
      {items.length === 0 ? <Empty title="Keine Benachrichtigungen">Hier erscheinen neutrale Hinweise, z. B. zu Anfragen oder Zahlungen.</Empty> : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((n) => {
            const link = memberLink(n.link);
            return (
              <li key={n.id} className="card tight row between" style={n.readAt ? { opacity: 0.75 } : undefined}>
                <span>
                  {!n.readAt && <span className="badge-count" style={{ marginLeft: 0, marginRight: 8 }}>neu</span>}
                  {link ? <Link href={link}>{n.title}</Link> : n.title}
                  <span className="dim" style={{ display: "block", fontSize: "0.85rem" }}>{formatDate(n.createdAt, true)}</span>
                </span>
                {!n.readAt && <HiddenForm action={markNotificationAction} fields={{ id: n.id }} submit="Gelesen" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
