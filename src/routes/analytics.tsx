import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useOrders } from "@/hooks/use-orders";
import { getPlatformMeta } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { TrendingUp, ShoppingCart, Repeat, PieChart as PieIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · OrderHub" }] }),
  component: Analytics,
});

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Analytics() {
  const { data: orders = [], isLoading } = useOrders();
  const valid = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      map.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    valid.forEach((o) => {
      const d = new Date(o.orderDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (map.has(key)) map.set(key, (map.get(key) || 0) + o.totalAmount);
    });
    return Array.from(map.entries()).map(([k, v]) => {
      const [, m] = k.split("-");
      return { month: monthNames[Number(m)], spent: v };
    });
  }, [valid]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach((o) => map.set(o.platform, (map.get(o.platform) || 0) + 1));
    return Array.from(map.entries())
      .map(([platform, count]) => ({ platform, count, color: getPlatformMeta(platform as any).color }))
      .sort((a, b) => b.count - a.count);
  }, [valid]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach((o) => map.set(o.category, (map.get(o.category) || 0) + o.totalAmount));
    const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    return Array.from(map.entries()).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [valid]);

  const topMerchants = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach((o) => map.set(o.merchant, (map.get(o.merchant) || 0) + o.totalAmount));
    return Array.from(map.entries())
      .map(([merchant, spent]) => ({ merchant, spent }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [valid]);

  const avgOrder = valid.reduce((s, o) => s + o.totalAmount, 0) / (valid.length || 1);
  const totalSpent = valid.reduce((s, o) => s + o.totalAmount, 0);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Spending patterns across every platform.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} hint="last 6 months" icon={TrendingUp} />
        <StatCard label="Total Orders" value={String(valid.length)} icon={ShoppingCart} />
        <StatCard label="Avg Order Value" value={formatCurrency(avgOrder)} icon={PieIcon} />
        <StatCard label="Order Frequency" value={`${(valid.length / 4).toFixed(1)}/wk`} hint="last month" icon={Repeat} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Monthly spending">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="spent" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Orders by platform">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byPlatform} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="platform" type="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {byPlatform.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Spending by category">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {byCategory.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {byCategory.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 capitalize">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Order frequency">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Line type="monotone" dataKey="spent" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Top merchants" className="mt-4">
        <ul className="divide-y">
          {topMerchants.map((m) => (
            <li key={m.merchant} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-medium">{m.merchant}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(m.spent)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 ${className ?? ""}`}>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
