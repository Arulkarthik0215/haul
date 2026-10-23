import { Check, Package, Truck, MapPin, ShoppingBag, XCircle, RotateCcw } from "lucide-react";
import type { TimelineEvent, OrderStatus } from "@/types/order";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const iconMap: Record<OrderStatus, typeof Check> = {
  ordered: ShoppingBag,
  packed: Package,
  shipped: Truck,
  out_for_delivery: MapPin,
  delivered: Check,
  cancelled: XCircle,
  refunded: RotateCcw,
};

interface Props {
  events: TimelineEvent[];
  currentStatus: OrderStatus;
}

export function Timeline({ events, currentStatus }: Props) {
  return (
    <ol className="relative space-y-6">
      {events.map((ev, i) => {
        const Icon = iconMap[ev.type];
        const active = ev.type === currentStatus;
        const done = i <= events.findIndex((e) => e.type === currentStatus);
        return (
          <li key={ev.id} className="relative flex gap-4">
            {i < events.length - 1 && (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-full w-px",
                  done ? "bg-ok/40" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card transition-colors",
                done ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-medium", !done && "text-muted-foreground")}>
                  {ev.title}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(ev.timestamp)}
                </span>
              </div>
              {ev.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{ev.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
