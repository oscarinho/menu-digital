import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Order, OrderItem, OrderStatus, Restaurant } from "@/lib/types";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const order = db
    .prepare(
      `SELECT o.*, t.code AS table_code, t.label AS table_label
       FROM orders o JOIN tables t ON t.id = o.table_id
       WHERE o.id = ?`
    )
    .get(id) as (Order & { table_code: string; table_label: string }) | undefined;
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(id) as OrderItem[];
  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(order.restaurant_id) as Restaurant;

  return NextResponse.json({
    order: { ...order, items },
    currency: restaurant.currency,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    branding: {
      logo: restaurant.logo,
      brandColor: restaurant.brand_color,
    },
    // Para que el cliente pueda pagar con Yape/Plin desde el tracking.
    payment: {
      yapeNumber: restaurant.yape_number,
      plinNumber: restaurant.plin_number,
      qr: restaurant.payment_qr,
    },
    // En la demo pública los números de Yape/Plin son ficticios: la pantalla de
    // pago lo advierte para que nadie transfiera dinero de verdad.
    demo: process.env.VECTARYX_DEMO === "1",
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: OrderStatus;
    paymentMethod?: string;
    claimPayment?: boolean;
  };
  const db = getDb();

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | Order
    | undefined;
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Acción pública (cliente): "ya pagué con Yape/Plin" → queda por confirmar
  // en caja. Solo transición unpaid → claimed, nada más.
  if (body.claimPayment) {
    if (order.payment_status === "unpaid") {
      db.prepare(
        `UPDATE orders SET payment_status = 'claimed',
         updated_at = datetime('now') WHERE id = ?`
      ).run(id);
    }
    const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    return NextResponse.json({ order: updated });
  }

  // Acciones de staff: cambiar estado (cocina) y confirmar cobro (caja).
  if (!(await requireStaff(order.restaurant_id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(body.status, id);
  }

  if (body.paymentMethod) {
    db.prepare(
      `UPDATE orders SET payment_status = 'paid', payment_method = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).run(String(body.paymentMethod), id);
  }

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return NextResponse.json({ order: updated });
}
