import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { SearchIcon } from "lucide-react";
import { OrderList } from "@/components/order-card";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader, PageLoading } from "@/components/page-header";
import { useOrders } from "@/hooks/use-orders";

const searchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search · OrderHub" }] }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: orders = [], isLoading } = useOrders();

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return orders
      .filter((o) =>
        [
          o.platform,
          o.merchant,
          o.orderId,
          o.status,
          o.category,
          String(o.totalAmount),
          ...o.products.map((p) => p.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [q, orders]);

  const suggestions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.platform))).slice(0, 5),
    [orders],
  );

  return (
    <PageContainer narrow>
      <PageHeader
        title="Search"
        description="Find any order by shop, item, order number or amount."
      />

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) =>
            navigate({ to: "/search", search: { q: e.target.value }, replace: true })
          }
          placeholder="Try “headphones” or “Swiggy”"
          aria-label="Search orders"
          className="h-14 w-full rounded-lg bg-card pl-12 pr-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus:bg-surface-2"
        />
      </div>

      {!q.trim() && suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Try</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => navigate({ to: "/search", search: { q: s }, replace: true })}
              className="rounded-md bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-surface-2"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {isLoading ? (
          <PageLoading />
        ) : !q.trim() ? (
          <EmptyState
            icon={SearchIcon}
            title="Search across every order"
            description="Results show up as you type."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title={`Nothing found for “${q}”`}
            description="Check the spelling, or try the shop name instead of the item."
          />
        ) : (
          <>
            <div className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {results.length} result{results.length === 1 ? "" : "s"}
            </div>
            <OrderList orders={results} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
