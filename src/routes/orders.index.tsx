import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { OrderCard } from "@/components/order-card";
import { useOrders } from "@/hooks/use-orders";
import type { OrderStatus, Platform } from "@/types/order";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { PackageSearch, Loader2 } from "lucide-react";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders · OrderHub" }] }),
  component: OrdersPage,
});

type Filter = "all" | "active" | OrderStatus;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "delivered", label: "Delivered" },
  { key: "shipped", label: "Shipped" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

function OrdersPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  
  const { data: orders = [], isLoading } = useOrders();

  const platforms = useMemo(
    () => Array.from(new Set(orders.map((o) => o.platform))) as Platform[],
    [orders],
  );

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (platform !== "all" && o.platform !== platform) return false;
        if (filter === "all") return true;
        if (filter === "active")
          return ["ordered", "packed", "shipped", "out_for_delivery"].includes(o.status);
        return o.status === filter;
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [filter, platform, orders]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {orders.length} orders
          </p>
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | "all")}
          className="h-9 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders match your filters"
          description="Try adjusting the platform or status filters above."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
