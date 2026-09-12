import { supabase } from "@/lib/supabase";
import { mockOrders } from "@/lib/mock-data";
import type { Order } from "@/types/order";

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

  // Map DB structure to Order interface if needed
  return (data || []) as unknown as Order[];
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

  return data as unknown as Order;
}
