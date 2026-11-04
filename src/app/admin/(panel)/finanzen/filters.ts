import type { OrderFilter } from "@/server/admin/finance";
import { sp, type SP } from "../../_lib/ui";

export const ORDER_STATUSES = ["created", "pending", "paid", "failed", "canceled", "refunded", "partially_refunded", "chargeback"];

export function orderFilterFrom(params: SP | URLSearchParams): OrderFilter {
  const get = (k: string) => (params instanceof URLSearchParams ? (params.get(k) ?? "").trim() : sp(params, k));
  const d = (s: string) => (s && !Number.isNaN(new Date(s).getTime()) ? new Date(s) : undefined);
  const status = get("status");
  return {
    q: get("q") || undefined,
    status: ORDER_STATUSES.includes(status) ? status : undefined,
    kind: ["subscription", "tokens", "ticket"].includes(get("kind")) ? get("kind") : undefined,
    provider: get("provider") || undefined,
    from: d(get("from")),
    to: d(get("to")),
  };
}
