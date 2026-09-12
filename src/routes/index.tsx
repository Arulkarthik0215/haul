import { createFileRoute } from "@tanstack/react-router";
import { Package, CheckCircle2, Wallet, RotateCcw } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { OrderCard } from "@/components/order-card";
import { useOrders } from "@/hooks/use-orders";
import { formatCurrency } from "@/lib/format";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · OrderHub" },
      { name: "description", content: "Your unified commerce timeline." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: orders = [], isLoading } = useOrders();

  const now = new Date();
  const thisMonth = (d: string) => {
    const dt = new Date(d);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };

  const active = orders.filter((o) =>
    ["ordered", "packed", "shipped", "out_for_delivery"].includes(o.status),
  );
  const deliveredThisMonth = orders.filter(
    (o) => o.status === "delivered" && o.deliveredDate && thisMonth(o.deliveredDate),
  );
  const spentThisMonth = orders
    .filter((o) => thisMonth(o.orderDate) && o.status !== "cancelled" && o.status !== "refunded")
    .reduce((s, o) => s + o.totalAmount, 0);
  const pendingReturns = orders.filter(
    (o) => o.status === "delivered" && o.returnDeadline && new Date(o.returnDeadline) > now,
  );

  const sorted = [...orders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
  );

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Good afternoon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's everything happening across your inbox.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active Orders"
          value={String(active.length)}
          hint="in transit right now"
          icon={Package}
          accent="oklch(0.7 0.17 55)"
        />
        <StatCard
          label="Delivered"
          value={String(deliveredThisMonth.length)}
          hint="this month"
          icon={CheckCircle2}
          accent="oklch(0.72 0.16 155)"
        />
        <StatCard
          label="Spent"
          value={formatCurrency(spentThisMonth)}
          hint="this month"
          icon={Wallet}
          accent="oklch(0.7 0.15 245)"
        />
        <StatCard
          label="Pending Returns"
          value={String(pendingReturns.length)}
          hint="within return window"
          icon={RotateCcw}
          accent="oklch(0.7 0.18 300)"
        />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
          <span className="text-xs text-muted-foreground">{sorted.length} orders</span>
        </div>
        <div className="space-y-2">
          {sorted.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      </div>
    </div>
  );
}
