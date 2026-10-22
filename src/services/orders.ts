import { supabase } from "@/lib/supabase";
import { mockOrders } from "@/lib/mock-data";
import type { Order, Product, TimelineEvent } from "@/types/order";

// The DB uses snake_case columns; the UI works with the camelCase Order interface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderRow(row: any): Order {
  return {
    id: row.id,
    platform: row.platform,
    merchant: row.merchant,
    orderId: row.order_id ?? "",
    status: row.status,
    totalAmount: Number(row.total_amount ?? 0),
    currency: row.currency || "INR",
    category: row.category,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: (row.products ?? []).map((p: any): Product => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity ?? 1,
      price: Number(p.price ?? 0),
      image: p.image_url ?? undefined,
    })),
    trackingNumber: row.tracking_number ?? undefined,
    trackingUrl: row.tracking_url ?? undefined,
    orderDate: row.order_date,
    expectedDelivery: row.expected_delivery ?? undefined,
    deliveredDate: row.delivered_date ?? undefined,
    returnDeadline: row.return_deadline ?? undefined,
    invoiceUrl: row.invoice_url ?? undefined,
    paymentMethod: row.payment_method ?? "",
    emailMessageId: row.email_message_id ?? "",
    timeline: (row.timeline ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any): TimelineEvent => ({
        id: t.id,
        type: t.event_type,
        title: t.title,
        timestamp: t.timestamp,
        description: t.description ?? undefined,
      }))
      .sort((a: TimelineEvent, b: TimelineEvent) => a.timestamp.localeCompare(b.timestamp)),
  };
}

export async function fetchOrders(): Promise<Order[]> {
  if (!supabase) {
    // Fallback to mock data if no Supabase config
    return mockOrders;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      products:order_products(*),
      timeline:order_timeline(*)
    `)
    .order("order_date", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }

  return (data || []).map(mapOrderRow);
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  if (!supabase) {
    return mockOrders.find((o) => o.id === id) || null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      products:order_products(*),
      timeline:order_timeline(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    console.error("Error fetching order by ID:", error);
    throw error;
  }

  return mapOrderRow(data);
}
