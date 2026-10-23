import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { fetchOrderById } from "@/services/orders";
import type { Product } from "@/types/order";
import { MerchantAvatar } from "@/components/merchant-avatar";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { PageContainer } from "@/components/page-header";
import { dueLabel, formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [{ title: "Order · OrderHub" }, { name: "robots", content: "noindex" }],
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
      <h1 className="text-xl font-semibold">Order not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been removed, or the link is wrong.
      </p>
      <Link
        to="/orders"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>
    </div>
  ),
});

function OrderDetail() {
  const { order } = Route.useLoaderData();
  const inTransit = ["ordered", "packed", "shipped", "out_for_delivery"].includes(order.status);
  const itemsTotal = order.products.reduce(
    (s: number, p: Product) => s + p.price * (p.quantity || 1),
    0,
  );

  return (
    <PageContainer narrow>
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>

      <div className="mt-6 rounded-lg bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <MerchantAvatar platform={order.platform} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted-foreground">
              {order.platform}
              {order.orderId && (
                <>
                  {" · "}
                  <span className="font-mono text-[13px]">#{order.orderId}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold leading-tight">{order.merchant}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} />
              {inTransit && order.expectedDelivery && (
                <span className="text-sm text-muted-foreground">
                  Arrives {dueLabel(order.expectedDelivery)}
                </span>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[13px] font-medium text-muted-foreground">Total paid</div>
            <div className="mt-1 text-[28px] font-semibold leading-none tabular-nums">
              {formatCurrency(order.totalAmount, order.currency)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-1 overflow-hidden rounded-lg md:grid-cols-[1fr_300px]">
        <section className="bg-card p-6">
          <h2 className="text-base font-semibold">Items</h2>
          {order.products.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The email didn't list individual items.
            </p>
          ) : (
            <ul className="mt-4 grid gap-px overflow-hidden rounded-md bg-border">
              {order.products.map((p: Product) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 bg-background px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium">{p.name}</div>
                    <div className="text-[13px] text-muted-foreground">Qty {p.quantity}</div>
                  </div>
                  <div className="text-[15px] font-medium tabular-nums">
                    {formatCurrency(p.price, order.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {order.products.length > 1 && itemsTotal > 0 && (
            <div className="mt-3 flex justify-between px-4 text-sm text-muted-foreground">
              <span>Items subtotal</span>
              <span className="tabular-nums">{formatCurrency(itemsTotal, order.currency)}</span>
            </div>
          )}

          {order.timeline.length > 0 && (
            <>
              <h2 className="mt-10 text-base font-semibold">Updates</h2>
              <div className="mt-5">
                <Timeline events={order.timeline} currentStatus={order.status} />
              </div>
            </>
          )}
        </section>

        <aside className="bg-card p-6">
          <h2 className="text-base font-semibold">Details</h2>
          <dl className="mt-4 space-y-4">
            <Detail label="Ordered">{formatDate(order.orderDate)}</Detail>
            {order.expectedDelivery && (
              <Detail label="Expected">{formatDate(order.expectedDelivery)}</Detail>
            )}
            {order.deliveredDate && (
              <Detail label="Delivered">{formatDate(order.deliveredDate)}</Detail>
            )}
            {order.paymentMethod && <Detail label="Payment">{order.paymentMethod}</Detail>}
            {order.trackingNumber && (
              <Detail label="Tracking">
                <span className="font-mono text-[13px]">{order.trackingNumber}</span>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm font-semibold text-primary"
                  >
                    Track parcel <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </Detail>
            )}
            {order.returnDeadline && (
              <Detail label="Return by">{formatDate(order.returnDeadline)}</Detail>
            )}
            <Detail label="Category">
              <span className="capitalize">{order.category}</span>
            </Detail>
          </dl>
          {order.invoiceUrl && (
            <a
              href={order.invoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex h-10 items-center justify-center gap-2 rounded-md bg-surface-2 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background"
            >
              View invoice <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium">{children}</dd>
    </div>
  );
}
