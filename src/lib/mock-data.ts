import type { Order, Platform, Category, OrderStatus } from "@/types/order";

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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const statusLabels: Record<OrderStatus, string> = {
  ordered: "Ordered",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function statusLabel(s: OrderStatus) {
  return statusLabels[s];
}

function buildTimeline(status: OrderStatus, orderDate: string) {
  const flow: OrderStatus[] = ["ordered", "packed", "shipped", "out_for_delivery", "delivered"];
  const idx = flow.indexOf(status);
  const events = [];
  const base = new Date(orderDate).getTime();
  const steps = idx === -1 ? flow.length : idx + 1;
  for (let i = 0; i < steps; i++) {
    const s = flow[i];
    events.push({
      id: `${s}-${i}`,
      type: s,
      title: statusLabels[s],
      timestamp: new Date(base + i * 24 * 3600 * 1000).toISOString(),
    });
  }
  if (status === "cancelled") {
    events.push({
      id: "cancelled",
      type: "cancelled" as OrderStatus,
      title: "Cancelled",
      timestamp: new Date(base + 12 * 3600 * 1000).toISOString(),
    });
  }
  if (status === "refunded") {
    events.push({
      id: "refunded",
      type: "refunded" as OrderStatus,
      title: "Refund Completed",
      timestamp: new Date(base + 5 * 24 * 3600 * 1000).toISOString(),
    });
  }
  return events;
}

interface Seed {
  platform: Platform;
  merchant: string;
  product: string;
  amount: number;
  status: OrderStatus;
  ago: number;
  payment: string;
}

const seeds: Seed[] = [
  { platform: "Amazon", merchant: "Amazon.in", product: "Keychron K2 Mechanical Keyboard", amount: 8499, status: "shipped", ago: 2, payment: "HDFC Credit Card" },
  { platform: "Swiggy", merchant: "McDonald's", product: "McSpicy Meal + McFlurry", amount: 420, status: "delivered", ago: 0, payment: "UPI · GPay" },
  { platform: "Myntra", merchant: "Nike", product: "Nike Air Zoom Pegasus 40", amount: 10995, status: "out_for_delivery", ago: 3, payment: "Myntra Credit" },
  { platform: "Blinkit", merchant: "Blinkit", product: "Groceries · Milk, Eggs, Bread", amount: 640, status: "delivered", ago: 1, payment: "UPI · Paytm" },
  { platform: "Zomato", merchant: "Behrouz Biryani", product: "Lucknowi Chicken Biryani", amount: 599, status: "delivered", ago: 4, payment: "UPI · GPay" },
  { platform: "Flipkart", merchant: "Sony", product: "Sony WH-1000XM5 Headphones", amount: 26990, status: "delivered", ago: 8, payment: "Axis Credit Card" },
  { platform: "Zepto", merchant: "Zepto", product: "Fresh Fruits & Vegetables", amount: 380, status: "delivered", ago: 2, payment: "UPI · PhonePe" },
  { platform: "Amazon", merchant: "Logitech", product: "Logitech MX Master 3S", amount: 8995, status: "delivered", ago: 12, payment: "HDFC Credit Card" },
  { platform: "BookMyShow", merchant: "PVR ICON", product: "Dune: Part Two · 2 tickets", amount: 780, status: "delivered", ago: 6, payment: "UPI · GPay" },
  { platform: "Uber", merchant: "Uber", product: "Ride · Indiranagar to Airport", amount: 512, status: "delivered", ago: 5, payment: "Uber Cash" },
  { platform: "Myntra", merchant: "H&M", product: "Cotton Oversized T-Shirt", amount: 1299, status: "packed", ago: 1, payment: "UPI · GPay" },
  { platform: "Ajio", merchant: "Levi's", product: "Levi's 511 Slim Fit Jeans", amount: 2799, status: "ordered", ago: 0, payment: "ICICI Credit Card" },
  { platform: "IRCTC", merchant: "Indian Railways", product: "12951 Rajdhani · BLR → NDLS", amount: 3245, status: "delivered", ago: 15, payment: "UPI · BHIM" },
  { platform: "Amazon", merchant: "Apple", product: "AirPods Pro (2nd Gen)", amount: 22990, status: "refunded", ago: 20, payment: "HDFC Credit Card" },
  { platform: "Flipkart", merchant: "boAt", product: "boAt Rockerz 550 Headphones", amount: 1499, status: "cancelled", ago: 9, payment: "UPI · PhonePe" },
  { platform: "Swiggy", merchant: "Blue Tokai", product: "Cold Brew + Croissant", amount: 385, status: "delivered", ago: 3, payment: "UPI · GPay" },
  { platform: "Zomato", merchant: "Third Wave Coffee", product: "Iced Latte + Sandwich", amount: 320, status: "delivered", ago: 7, payment: "UPI · GPay" },
  { platform: "Blinkit", merchant: "Blinkit", product: "Detergent, Cleaning Supplies", amount: 890, status: "delivered", ago: 10, payment: "Credit Card" },
  { platform: "Amazon", merchant: "Kindle Store", product: "Atomic Habits · Kindle Edition", amount: 249, status: "delivered", ago: 14, payment: "Amazon Pay" },
  { platform: "Myntra", merchant: "Adidas", product: "Adidas Ultraboost Light", amount: 15999, status: "shipped", ago: 4, payment: "HDFC Credit Card" },
  { platform: "Uber", merchant: "Uber Eats", product: "Late night snacks", amount: 245, status: "delivered", ago: 6, payment: "UPI" },
  { platform: "Flipkart", merchant: "Samsung", product: "Samsung 27\" Curved Monitor", amount: 18490, status: "out_for_delivery", ago: 5, payment: "SBI Credit Card" },
  { platform: "BookMyShow", merchant: "Phoenix Marketcity", product: "Coldplay Concert · 1 ticket", amount: 12500, status: "delivered", ago: 30, payment: "HDFC Credit Card" },
  { platform: "Zepto", merchant: "Zepto Cafe", product: "Morning Coffee & Breakfast", amount: 180, status: "delivered", ago: 1, payment: "UPI" },
];

export const mockOrders: Order[] = seeds.map((s, i) => {
  const orderDate = daysAgo(s.ago);
  const meta = platformMeta[s.platform];
  const timeline = buildTimeline(s.status, orderDate);
  const delivered = timeline.find((t) => t.type === "delivered");
  return {
    id: `ord_${i + 1}`,
    platform: s.platform,
    merchant: s.merchant,
    orderId: `${s.platform.slice(0, 3).toUpperCase()}-${(1000000 + i * 137).toString()}`,
    status: s.status,
    totalAmount: s.amount,
    currency: "INR",
    category: meta.category,
    products: [{ id: `p${i}`, name: s.product, quantity: 1, price: s.amount }],
    trackingNumber: s.status === "ordered" || s.status === "cancelled" ? undefined : `TRK${(90000 + i * 71).toString()}IN`,
    trackingUrl: "#",
    orderDate,
    expectedDelivery: s.status !== "delivered" && s.status !== "cancelled" && s.status !== "refunded" ? daysAhead(2) : undefined,
    deliveredDate: delivered?.timestamp,
    returnDeadline: s.status === "delivered" ? daysAhead(7) : undefined,
    invoiceUrl: "#",
    paymentMethod: s.payment,
    emailMessageId: `msg_${i}@gmail.com`,
    timeline,
  };
});

export function getOrderById(id: string) {
  return mockOrders.find((o) => o.id === id);
}
