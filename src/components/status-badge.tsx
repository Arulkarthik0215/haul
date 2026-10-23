import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/order";
import { statusLabel } from "@/lib/platforms";

const styles: Record<OrderStatus, string> = {
  ordered: "bg-status-ordered/12 text-status-ordered",
  packed: "bg-status-packed/12 text-status-packed",
  shipped: "bg-status-shipped/14 text-status-shipped",
  out_for_delivery: "bg-status-ofd/14 text-status-ofd",
  delivered: "bg-status-delivered/12 text-status-delivered",
  cancelled: "bg-status-cancelled/12 text-status-cancelled",
  refunded: "bg-status-refunded/14 text-status-refunded",
};

interface Props {
  status: OrderStatus;
  className?: string;
  withDot?: boolean;
}

export function StatusBadge({ status, className, withDot = true }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        styles[status] ?? styles.ordered,
        className,
      )}
    >
      {withDot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {statusLabel(status) ?? status}
    </span>
  );
}
