export type OrderStatus =
  | "ordered"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type Platform =
  | "Amazon"
  | "Flipkart"
  | "Swiggy"
  | "Zomato"
  | "Blinkit"
  | "Zepto"
  | "Myntra"
  | "Ajio"
  | "BookMyShow"
  | "Uber"
  | "IRCTC"
  | "Other";

export type Category = "shopping" | "food" | "grocery" | "entertainment" | "travel";

export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface TimelineEvent {
  id: string;
  type: OrderStatus;
  title: string;
  timestamp: string;
  description?: string;
}

export interface Order {
  id: string;
  platform: Platform;
  merchant: string;
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  category: Category;
  products: Product[];
  trackingNumber?: string;
  trackingUrl?: string;
  orderDate: string;
  expectedDelivery?: string;
  deliveredDate?: string;
  returnDeadline?: string;
  invoiceUrl?: string;
  paymentMethod: string;
  emailMessageId: string;
  timeline: TimelineEvent[];
}

export interface User {
  id: string;
  email: string;
  avatar?: string;
  displayName: string;
}
