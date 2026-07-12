export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

// unpaid → (cliente informa pago Yape/Plin) claimed → (caja confirma) paid
export type PaymentStatus = "unpaid" | "claimed" | "paid";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Recibido",
  preparing: "En preparación",
  ready: "Listo para servir",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
];

export type StaffRole = "staff" | "admin";

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  currency: string;
  country: string;
  // Zona IANA del local: define qué es "hoy" (número diario de pedido, métricas).
  timezone: string;
  phone: string;
  address: string;
  yape_number: string;
  plin_number: string;
  payment_qr: string;
  logo: string;
  cover_image: string;
  brand_color: string;
  active: number;
  plan: string;
  monthly_fee_cents: number;
  // PIN de cocina y caja: lo conoce todo el equipo.
  staff_pin: string;
  // PIN del dueño: carta, precios, números de Yape/Plin y los propios PINes.
  admin_pin: string;
  created_at: string;
}

// Lo que ve el cliente en el navegador: nunca incluye staff_pin ni datos del plan.
export type PublicRestaurant = Pick<
  Restaurant,
  | "id"
  | "slug"
  | "name"
  | "currency"
  | "country"
  | "phone"
  | "address"
  | "yape_number"
  | "plin_number"
  | "payment_qr"
  | "logo"
  | "cover_image"
  | "brand_color"
  | "active"
>;

export interface Table {
  id: string;
  restaurant_id: string;
  code: string;
  label: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  detail: string;
  ingredients: string;
  price_cents: number;
  emoji: string;
  image: string;
  available: number;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string;
  daily_number: number;
  status: OrderStatus;
  notes: string;
  payment_method: string;
  payment_status: PaymentStatus;
  total_cents: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  notes: string;
}

export interface OrderWithDetails extends Order {
  table_code: string;
  table_label: string;
  items: OrderItem[];
}
