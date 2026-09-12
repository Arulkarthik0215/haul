import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, FileText, CreditCard, Calendar, Truck } from "lucide-react";
import { fetchOrderById } from "@/services/orders";
import type { Product } from "@/types/order";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Order ${params.id} · OrderHub` }, { name: "robots", content: "noindex" }],
  }),
  loader: async ({ context, params }) => {
    const order = await context.queryClient.ensureQueryData({
      queryKey: ["orders", params.id],
      queryFn: () => fetchOrderById(params.id),
    });
    if (!order) throw notFound();
    return { order };
  },
  component: OrderDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-lg font-semibold">Order not found</h1>
      <Link to="/orders" className="mt-4 inline-block text-sm text-muted-foreground underline">
        Back to orders
      </Link>
    </div>
  ),
});

function OrderDetail() {
  const { order } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <MerchantAvatar platform={order.platform} size="lg" />
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{order.platform}</span>
              <span>·</span>
              <span className="font-mono">{order.orderId}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{order.merchant}</h1>
            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatCurrency(order.totalAmount, order.currency)}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <div className="mt-5">
              <Timeline events={order.timeline} currentStatus={order.status} />
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Items</h2>
            <ul className="mt-3 divide-y">
              {order.products.map((p: Product) => (
                <li key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Qty {p.quantity}</div>
                  </div>
                  <div className="text-sm font-medium tabular-nums">
                    {formatCurrency(p.price, order.currency)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <InfoBlock icon={Calendar} label="Order date" value={formatDate(order.orderDate)} />
          {order.expectedDelivery && (
            <InfoBlock
              icon={Truck}
              label="Expected delivery"
              value={formatDate(order.expectedDelivery)}
            />
          )}
          {order.deliveredDate && (
            <InfoBlock icon={Truck} label="Delivered" value={formatDate(order.deliveredDate)} />
          )}
          <InfoBlock icon={CreditCard} label="Payment" value={order.paymentMethod} />
          {order.trackingNumber && (
            <InfoBlock
              icon={Truck}
              label="Tracking"
              value={order.trackingNumber}
              action={
                order.trackingUrl ? (
                  <a
                    href={order.trackingUrl}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Track <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
          )}
          {order.returnDeadline && (
            <InfoBlock
              icon={Calendar}
              label="Return window"
              value={`Until ${formatDate(order.returnDeadline)}`}
            />
          )}
          {order.invoiceUrl && (
            <a
              href={order.invoiceUrl}
              className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm hover:border-foreground/20"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Invoice
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-sm font-medium">{value}</div>
        {action}
      </div>
    </div>
  );
}
