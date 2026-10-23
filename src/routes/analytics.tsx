import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartColumn } from "lucide-react";
import { useOrders } from "@/hooks/use-orders";
import { formatCurrency } from "@/lib/format";
import { StatCard, StatGrid } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader, PageLoading } from "@/components/page-header";
import { SyncButton } from "@/components/sync-provider";
import type { Category } from "@/types/order";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Insights · Haul" }] }),
  component: Insights,
});

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Colour follows the category, never its rank (fixed categorical slots)
const CATEGORY_SLOTS: Record<Category, string> = {
  shopping: "var(--chart-1)",
  food: "var(--chart-2)",
  grocery: "var(--chart-3)",
  entertainment: "var(--chart-4)",
  travel: "var(--chart-5)",
};

function compactRupees(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `₹${v}`;
}

function Insights() {
  const { data: orders = [], isLoading } = useOrders();
  const valid = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded"),
    [orders],
  );

  const monthly = useMemo(() => {
    const rows: { key: string; month: string; spent: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      rows.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthNames[d.getMonth()],
        spent: 0,
        orders: 0,
      });
    }
    valid.forEach((o) => {
      const d = new Date(o.orderDate);
      const row = rows.find((r) => r.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (row) {
        row.spent += o.totalAmount;
        row.orders += 1;
      }
    });
    return rows;
  }, [valid]);

  const byCategory = useMemo(() => {
    const total = valid.reduce((s, o) => s + o.totalAmount, 0) || 1;
    return (Object.keys(CATEGORY_SLOTS) as Category[])
      .map((c) => {
        const spent = valid.filter((o) => o.category === c).reduce((s, o) => s + o.totalAmount, 0);
        return { category: c, spent, share: spent / total, color: CATEGORY_SLOTS[c] };
      })
      .filter((c) => c.spent > 0);
  }, [valid]);

  const byShop = useMemo(() => {
    const map = new Map<string, { spent: number; orders: number }>();
    valid.forEach((o) => {
      const cur = map.get(o.platform) ?? { spent: 0, orders: 0 };
      map.set(o.platform, { spent: cur.spent + o.totalAmount, orders: cur.orders + 1 });
    });
    return Array.from(map.entries())
      .map(([shop, v]) => ({ shop, ...v }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 8);
  }, [valid]);

  if (isLoading) return <PageLoading />;

  const totalSpent = valid.reduce((s, o) => s + o.totalAmount, 0);
  const sixMonthSpend = monthly.reduce((s, m) => s + m.spent, 0);
  const avgOrder = totalSpent / (valid.length || 1);
  const topShop = byShop[0];
  const maxShop = topShop?.spent || 1;

  return (
    <PageContainer>
      <PageHeader title="Insights" description="Where your money goes, across every shop." />

      {valid.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="Nothing to chart yet"
          description="Once you've synced your inbox, your spending by month, category and shop shows up here."
          action={<SyncButton />}
        />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Spent, last 6 months" value={formatCurrency(sixMonthSpend)} />
            <StatCard
              label="Orders"
              value={String(valid.length)}
              hint="excluding cancelled & refunded"
            />
            <StatCard label="Average order" value={formatCurrency(avgOrder)} />
            <StatCard
              label="Top shop"
              value={topShop?.shop ?? "—"}
              hint={
                topShop
                  ? `${formatCurrency(topShop.spent)} across ${topShop.orders} orders`
                  : undefined
              }
            />
          </StatGrid>

          <div className="mt-4 grid gap-1 overflow-hidden rounded-lg lg:grid-cols-[3fr_2fr]">
            <Panel title="Monthly spending" subtitle="Last 6 months">
              <div
                className="h-64"
                role="img"
                aria-label="Bar chart of spending per month for the last six months"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={compactRupees}
                    />
                    <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<MonthTooltip />} />
                    <Bar
                      dataKey="spent"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="By category" subtitle="Share of all spending">
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {byCategory.map((c) => (
                  <span
                    key={c.category}
                    style={{ width: `${c.share * 100}%`, background: c.color }}
                  />
                ))}
              </div>
              <ul className="mt-5 space-y-3">
                {byCategory.map((c) => (
                  <li key={c.category} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    <span className="flex-1 capitalize">{c.category}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(c.share * 100)}%
                    </span>
                    <span className="w-24 text-right font-medium tabular-nums">
                      {formatCurrency(c.spent)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg">
            <Panel title="Where you shop" subtitle="Total spent per shop">
              <ul className="space-y-4">
                {byShop.map((s) => (
                  <li
                    key={s.shop}
                    className="grid grid-cols-[7rem_1fr_6.5rem] items-center gap-4 text-sm sm:grid-cols-[9rem_1fr_8rem]"
                  >
                    <span className="truncate font-medium">{s.shop}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(2, (s.spent / maxShop) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="font-medium">{formatCurrency(s.spent)}</span>
                      <span className="ml-1.5 text-muted-foreground">· {s.orders}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MonthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { month: string; spent: number; orders: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-sm shadow-[var(--shadow-soft)]">
      <div className="font-medium">{row.month}</div>
      <div className="tabular-nums text-muted-foreground">
        {formatCurrency(row.spent)} · {row.orders} order{row.orders === 1 ? "" : "s"}
      </div>
    </div>
  );
}
