import type { Category, OrderStatus, Platform } from "@/types/order";

const platformMeta: Record<Platform, { category: Category; color: string; letter: string }> = {
  Amazon: { category: "shopping", color: "oklch(0.72 0.17 55)", letter: "A" },
  Flipkart: { category: "shopping", color: "oklch(0.68 0.16 245)", letter: "F" },
  Swiggy: { category: "food", color: "oklch(0.7 0.19 40)", letter: "S" },
  Zomato: { category: "food", color: "oklch(0.62 0.22 15)", letter: "Z" },
  Blinkit: { category: "grocery", color: "oklch(0.82 0.16 95)", letter: "B" },
  Zepto: { category: "grocery", color: "oklch(0.62 0.2 300)", letter: "Z" },
  Myntra: { category: "shopping", color: "oklch(0.65 0.2 350)", letter: "M" },
  Ajio: { category: "shopping", color: "oklch(0.35 0.02 260)", letter: "A" },
  BookMyShow: { category: "entertainment", color: "oklch(0.6 0.22 25)", letter: "B" },
  Uber: { category: "travel", color: "oklch(0.3 0.01 260)", letter: "U" },
  IRCTC: { category: "travel", color: "oklch(0.55 0.16 245)", letter: "I" },
  Other: { category: "shopping", color: "oklch(0.5 0.03 260)", letter: "•" },
};

export function getPlatformMeta(p: Platform) {
  return platformMeta[p] ?? platformMeta.Other;
}

const statusLabels: Record<OrderStatus, string> = {
  ordered: "Ordered",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function statusLabel(s: OrderStatus) {
  return statusLabels[s];
}
