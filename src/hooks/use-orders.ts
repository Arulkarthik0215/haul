import { useQuery } from "@tanstack/react-query";
import { fetchOrders, fetchOrderById } from "@/services/orders";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });
}

export function useOrderById(id: string) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => fetchOrderById(id),
    enabled: !!id,
  });
}
