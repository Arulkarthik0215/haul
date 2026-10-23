import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Order } from "@/types/order";
import { MerchantAvatar } from "./merchant-avatar";
import { StatusBadge } from "./status-badge";
import { dueLabel, formatCurrency, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const inTransit = ["ordered", "packed", "shipped", "out_for_delivery"];

/** One order as a row; use inside <OrderList>. */
export function OrderCard({ order }: { order: Order }) {
  const title = order.products[0]?.name ?? order.merchant;
  const extraItems = order.products.length - 1;
  const showEta = order.expectedDelivery && inTransit.includes(order.status);

  return (
    <Link
      to="/orders/$id"
      params={{ id: order.id }}
      className="group flex items-center gap-4 bg-card px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
    >
      <MerchantAvatar platform={order.platform} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">
          {title}
          {extraItems > 0 && (
            <span className="font-normal text-muted-foreground"> +{extraItems} more</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <span>
            {order.merchant !== order.platform
              ? `${order.platform} · ${order.merchant}`
              : order.platform}
          </span>
          <span aria-hidden>·</span>
          <span>{relativeTime(order.orderDate)}</span>
          <StatusBadge status={order.status} className="sm:hidden" />
        </div>
      </div>
      <div className="hidden w-36 shrink-0 sm:block">
        <StatusBadge status={order.status} />
        {showEta && (
          <div className="mt-1 text-xs text-muted-foreground">
            Arrives {dueLabel(order.expectedDelivery!)}
          </div>
        )}
      </div>
      <div className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums sm:w-24">
        {formatCurrency(order.totalAmount, order.currency)}
      </div>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

/** Rows joined by hairlines inside one rounded surface. */
export function OrderList({ orders, className }: { orders: Order[]; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-lg bg-border", className)}>
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}
