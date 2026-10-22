import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Order } from "@/types/order";
import { MerchantAvatar } from "./merchant-avatar";
import { StatusBadge } from "./status-badge";
import { formatCurrency, relativeTime } from "@/lib/format";

interface Props {
  order: Order;
}

export function OrderCard({ order }: Props) {
  return (
    <Link
      to="/orders/$id"
      params={{ id: order.id }}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-[var(--shadow-soft)]"
    >
      <MerchantAvatar platform={order.platform} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{order.platform}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground">{relativeTime(order.orderDate)}</span>
        </div>
        <div className="mt-0.5 truncate text-sm font-medium">{order.products[0]?.name ?? order.merchant}</div>
        <div className="mt-1 flex items-center gap-3">
          <StatusBadge status={order.status} />
          {order.expectedDelivery && order.status !== "delivered" && order.status !== "cancelled" && (
            <span className="text-xs text-muted-foreground">
              Expected {relativeTime(order.expectedDelivery)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(order.totalAmount, order.currency)}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
