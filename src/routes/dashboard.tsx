import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, Mail } from "lucide-react";
import { StatCard, StatGrid } from "@/components/stat-card";
import { OrderList } from "@/components/order-card";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageLoading, SectionTitle } from "@/components/page-header";
import { LastSynced, SyncButton } from "@/components/sync-provider";
import { useCurrentUser } from "@/components/user-chip";
import { useOrders } from "@/hooks/use-orders";
import { dueLabel, formatCurrency, relativePhrase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/order";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Home · Haul" },
      { name: "description", content: "Where all your online orders stand, in one place." },
    ],
  }),
  component: Dashboard,
});

const IN_TRANSIT: OrderStatus[] = ["ordered", "packed", "shipped", "out_for_delivery"];

// Uses the viewer's local clock (this page only renders in the browser, never on the server)
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { data: orders = [], isLoading } = useOrders();
  const { firstName } = useCurrentUser();

  if (isLoading) return <PageLoading />;

  const now = new Date();
  const thisMonth = (d: string) => {
    const dt = new Date(d);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };

  const sorted = [...orders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
  );
  const active = sorted.filter((o) => IN_TRANSIT.includes(o.status));
  const deliveredThisMonth = orders.filter(
    (o) => o.status === "delivered" && thisMonth(o.deliveredDate ?? o.orderDate),
  );
  const spentThisMonth = orders
    .filter((o) => thisMonth(o.orderDate) && o.status !== "cancelled" && o.status !== "refunded")
    .reduce((s, o) => s + o.totalAmount, 0);
  const openReturns = orders.filter(
    (o) => o.status === "delivered" && o.returnDeadline && new Date(o.returnDeadline) > now,
  );

  return (
    <PageContainer>
      <div className="animate-rise-in">
        <h1 className="text-[28px] font-semibold leading-tight md:text-[34px]">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {active.length > 0
            ? `${active.length} order${active.length === 1 ? " is" : "s are"} on the way.`
            : "Nothing in transit right now."}
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-4 rounded-lg bg-card p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-background text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">Keep your orders up to date</div>
            <div className="text-sm text-muted-foreground">
              <LastSynced /> · Haul reads only order, shipping and receipt emails.
            </div>
          </div>
        </div>
        <SyncButton className="w-full sm:w-auto" />
      </div>

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Inbox}
            title="No orders yet"
            description="Sync your Gmail inbox and Haul will pick out your order confirmations, shipping updates and receipts."
            action={<SyncButton />}
          />
        </div>
      ) : (
        <>
          <StatGrid className="mt-4">
            <StatCard
              label="On the way"
              value={String(active.length)}
              hint={active.length ? "orders in transit" : "nothing in transit"}
            />
            <StatCard
              label="Delivered"
              value={String(deliveredThisMonth.length)}
              hint="this month"
            />
            <StatCard label="Spent" value={formatCurrency(spentThisMonth)} hint="this month" />
            <StatCard
              label="Return windows"
              value={String(openReturns.length)}
              hint={openReturns.length ? "still open" : "none open"}
            />
          </StatGrid>

          {active.length > 0 && (
            <section className="mt-12">
              <SectionTitle
                aside={
                  <Link to="/orders" className="hover:text-foreground">
                    See all
                  </Link>
                }
              >
                On the way
              </SectionTitle>
              <div className="grid gap-1 overflow-hidden rounded-lg sm:grid-cols-2 lg:grid-cols-3">
                {active.slice(0, 3).map((o) => (
                  <TransitCard key={o.id} order={o} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-12">
            <SectionTitle
              aside={
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  All orders <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              Recent orders
            </SectionTitle>
            <OrderList orders={sorted.slice(0, 8)} />
          </section>
        </>
      )}
    </PageContainer>
  );
}

const TRACK: { status: OrderStatus[]; label: string }[] = [
  { status: ["ordered", "packed"], label: "Ordered" },
  { status: ["shipped"], label: "Shipped" },
  { status: ["out_for_delivery"], label: "Out for delivery" },
  { status: ["delivered"], label: "Delivered" },
];

function TransitCard({ order }: { order: Order }) {
  const step = TRACK.findIndex((t) => t.status.includes(order.status));
  return (
    <Link
      to="/orders/$id"
      params={{ id: order.id }}
      className="group flex flex-col bg-card p-5 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        <MerchantAvatar platform={order.platform} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">
            {order.products[0]?.name ?? order.merchant}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {order.platform} · ordered {relativePhrase(order.orderDate)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-1" aria-label={`Progress: ${TRACK[step]?.label}`}>
        {TRACK.map((t, i) => (
          <span
            key={t.label}
            className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-surface-2")}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge status={order.status} />
        <span className="text-[13px] text-muted-foreground">
          {order.expectedDelivery ? `Arrives ${dueLabel(order.expectedDelivery)}` : "No date yet"}
        </span>
      </div>
    </Link>
  );
}
