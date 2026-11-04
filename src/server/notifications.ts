import { db } from "./db";

/** Benachrichtigungen je Person. Titel sind neutral (keine Nachrichtentexte, keine intimen Inhalte). */
export async function listNotifications(userId: string, limit = 100) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Markiert eine (eigene) oder alle eigenen Benachrichtigungen als gelesen. */
export async function markRead(userId: string, id?: string) {
  const r = await db.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  return r.count;
}
