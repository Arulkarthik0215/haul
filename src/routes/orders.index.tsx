import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Inbox, PackageSearch } from "lucide-react";
import { OrderList } from "@/components/order-card";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader, PageLoading } from "@/components/page-header";
import { SyncButton } from "@/components/sync-provider";
import { useOrders } from "@/hooks/use-orders";
import { formatCurrency } from "@/lib/format";
import type { Order, OrderStatus, Platform } from "@/types/order";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders · OrderHub" }] }),
  component: OrdersPage,
});

type Filter = "all" | "active" | OrderStatus;

const IN_TRANSIT: OrderStatus[] = ["ordered", "packed", "shipped", "out_for_delivery"];

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "On the way" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

function matches(o: Order, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "active") return IN_TRANSIT.includes(o.status);
  return o.status === filter;
}

function OrdersPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const { data: orders = [], isLoading } = useOrders();

  const platforms = useMemo(
    () => Array.from(new Set(orders.map((o) => o.platform))).sort() as Platform[],
    [orders],
  );

  const filtered = useMemo(
    () =>
      orders
        .filter((o) => (platform === "all" || o.platform === platform) && matches(o, filter))
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
    [filter, platform, orders],
  );

  // Group by month so long histories stay scannable
  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filtered) {
      const key = new Date(o.orderDate).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (isLoading) return <PageLoading />;

  return (
    <PageContainer>
      <PageHeader
        title="Orders"
        description={
          orders.length
            ? `${orders.length} order${orders.length === 1 ? "" : "s"} found in your inbox`
            : "Everything you've bought online, in one list"
        }
        actions={
          platforms.length > 1 && (
            <label className="relative">
              <span className="sr-only">Platform</span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform | "all")}
                className="h-10 appearance-none rounded-md bg-surface pl-3 pr-9 text-sm font-medium outline-none transition-colors hover:bg-surface-2"
              >
                <option value="all">All shops</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>
          )
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No orders yet"
          description="Sync your Gmail inbox to bring in your order confirmations and shipping updates."
          action={<SyncButton />}
        />
      ) : (
        <>
          <div role="group" aria-label="Filter by status" className="mb-8 flex flex-wrap gap-1">
            {filters.map((f) => {
              const count = orders.filter(
                (o) => (platform === "all" || o.platform === platform) && matches(o, f.key),
              ).length;
              const selected = filter === f.key;
              return (
                <button
                  key={f.key}
                  aria-pressed={selected}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "relative overflow-hidden rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-surface-2 text-foreground"
                      : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    {count}
                  </span>
                  {selected && (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-primary" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nothing here"
              description="No orders match this filter. Try another status or shop."
            />
          ) : (
            <div className="space-y-10">
              {groups.map(([month, list]) => (
                <section key={month}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-base font-semibold">{month}</h2>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(
                        list
                          .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
                          .reduce((s, o) => s + o.totalAmount, 0),
                      )}
                    </span>
                  </div>
                  <OrderList orders={list} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
