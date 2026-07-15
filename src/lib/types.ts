export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

// unpaid → (cliente informa pago Yape/Plin) claimed → (caja confirma) paid
export type PaymentStatus = "unpaid" | "claimed" | "paid";

// El nombre de cada estado ("Recibido" / "Received" / "已接单") vive en lib/i18n:
// depende de quién mire la pantalla, no del dominio. Aquí solo queda el orden.
export const ORDER_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
];

export type StaffRole = "staff" | "admin";

// Cómo trabaja el local, y qué pantallas usa:
//   'despacho' — sin mesas ni mozos; se pide en el mostrador o del QR único y se
//                recoge cuando la cocina canta el número. No hay salón.
//   'salon'    — lo de siempre: QR por mesa, mozos, liberar mesa.
//   'mixto'    — mesas con QR y además pedido de mostrador para llevar.
export type ServiceMode = "despacho" | "salon" | "mixto";

// De dónde nació el pedido. 'mesa' exige table_id; 'mostrador' lo deja en null.
export type OrderOrigin = "mesa" | "mostrador";

// Quién mueve el plato hasta el comensal.
export type OrderDelivery = "mozo" | "recojo";

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  currency: string;
  country: string;
  // Zona IANA del local: define qué es "hoy" (número diario de pedido, métricas).
  timezone: string;
  // Modo de servicio: decide qué pantallas ve el local y si el pedido nace de una
  // mesa o del mostrador. Ver ServiceMode.
  service_mode: ServiceMode;
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
  // No es un dato sensible: es cómo trabaja el local, y las pantallas del cliente y
  // la puerta lo necesitan para saber qué mostrar (mesa vs. mostrador, salón o no).
  | "service_mode"
  | "active"
>;

export interface Table {
  id: string;
  restaurant_id: string;
  code: string;
  label: string;
  // Cuándo alguien recogió la mesa por última vez ('' = nunca). La mesa está libre
  // si su última cuenta se cerró antes de esta fecha: pagar no la libera, porque el
  // comensal sigue sentado y la app no tiene forma de saber que se fue.
  freed_at: string;
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
  // null en un pedido de mostrador (origin='mostrador'): no salió de ninguna mesa.
  table_id: string | null;
  daily_number: number;
  status: OrderStatus;
  notes: string;
  payment_method: string;
  payment_status: PaymentStatus;
  total_cents: number;
  origin: OrderOrigin;
  delivery: OrderDelivery;
  // Nombre que dejó el cliente de mostrador ('' si no dejó, o si es pedido de mesa).
  customer_name: string;
  // Cuándo cruzó a listo / entregado ('' = todavía no). Se marca una sola vez.
  ready_at: string;
  delivered_at: string;
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
  // null cuando el pedido es de mostrador: no hay mesa que nombrar. Las pantallas
  // muestran entonces el número de pedido ("Pedido #12") en vez de "Mesa 4".
  table_code: string | null;
  table_label: string | null;
  items: OrderItem[];
}
