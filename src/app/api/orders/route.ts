import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { businessDayRange, getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type {
  MenuItem,
  Order,
  OrderItem,
  OrderWithDetails,
  Restaurant,
  Table,
} from "@/lib/types";

interface CreateOrderBody {
  restaurantSlug: string;
  tableCode: string;
  paymentMethod?: string;
  notes?: string;
  items: { id: string; quantity: number; notes?: string }[];
}

// El comensal no se autentica (y así debe ser), pero sin límite un script podría
// inundar la cocina de comandas falsas. Una mesa real no pide 3 veces por minuto.
const MAX_ORDERS = 3;
const WINDOW_MS = 60_000;
const MAX_LINES = 40;

export async function POST(req: Request) {
  const body = (await req.json()) as CreateOrderBody;
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(body.restaurantSlug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!restaurant.active) {
    return NextResponse.json(
      { error: "Este restaurante no está recibiendo pedidos por ahora" },
      { status: 403 }
    );
  }

  const table = db
    .prepare("SELECT * FROM tables WHERE restaurant_id = ? AND code = ?")
    .get(restaurant.id, body.tableCode) as Table | undefined;
  if (!table) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  const limit = rateLimit(
    `order:${clientIp(req)}:${restaurant.id}:${table.id}`,
    MAX_ORDERS,
    WINDOW_MS
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Ya enviaste varios pedidos seguidos. Espera ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "El pedido está vacío" }, { status: 400 });
  }
  if (body.items.length > MAX_LINES) {
    return NextResponse.json(
      { error: `Un pedido no puede tener más de ${MAX_LINES} productos distintos` },
      { status: 400 }
    );
  }

  const getItem = db.prepare(
    "SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ? AND available = 1"
  );

  const lines: { item: MenuItem; quantity: number; notes: string }[] = [];
  for (const line of body.items) {
    const quantity = Math.floor(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    const item = getItem.get(line.id, restaurant.id) as MenuItem | undefined;
    if (!item) {
      return NextResponse.json(
        { error: "Un producto del pedido ya no está disponible" },
        { status: 409 }
      );
    }
    lines.push({ item, quantity, notes: String(line.notes ?? "").slice(0, 300) });
  }

  const total = lines.reduce((sum, l) => sum + l.item.price_cents * l.quantity, 0);
  const orderId = randomUUID();
  // "Hoy" es el día del local, no el de UTC: en Lima el día UTC cambia a las
  // 7 pm y el número de pedido se reiniciaría a #1 en plena cena.
  const day = businessDayRange(restaurant.timezone);

  const createOrder = db.transaction(() => {
    const { n } = db
      .prepare(
        `SELECT COUNT(*) AS n FROM orders
         WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`
      )
      .get(restaurant.id, day.start, day.end) as { n: number };

    db.prepare(
      `INSERT INTO orders (id, restaurant_id, table_id, daily_number, status, notes, payment_method, total_cents)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(
      orderId,
      restaurant.id,
      table.id,
      n + 1,
      String(body.notes ?? "").slice(0, 500),
      String(body.paymentMethod ?? ""),
      total
    );

    const insertLine = db.prepare(
      `INSERT INTO order_items (id, order_id, menu_item_id, name, unit_price_cents, quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const l of lines) {
      insertLine.run(
        randomUUID(),
        orderId,
        l.item.id,
        l.item.name,
        l.item.price_cents,
        l.quantity,
        l.notes
      );
    }
    return n + 1;
  });

  const dailyNumber = createOrder();
  return NextResponse.json({ id: orderId, dailyNumber, totalCents: total }, { status: 201 });
}

// Listado de pedidos para cocina/caja. Solo personal del restaurante.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const view = searchParams.get("view") ?? "kitchen";
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(restaurant.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const args: unknown[] = [restaurant.id];
  let where: string;
  if (view === "kitchen") {
    where = "o.status IN ('pending','preparing','ready')";
  } else if (view === "caja") {
    where = "o.payment_status != 'paid' AND o.status != 'cancelled'";
  } else {
    const day = businessDayRange(restaurant.timezone);
    where = "o.created_at >= ? AND o.created_at < ?";
    args.push(day.start, day.end);
  }

  const orders = db
    .prepare(
      `SELECT o.*, t.code AS table_code, t.label AS table_label
       FROM orders o JOIN tables t ON t.id = o.table_id
       WHERE o.restaurant_id = ? AND ${where}
       ORDER BY o.created_at ASC`
    )
    .all(...args) as (Order & { table_code: string; table_label: string })[];

  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const result: OrderWithDetails[] = orders.map((o) => ({
    ...o,
    items: getItems.all(o.id) as OrderItem[],
  }));

  return NextResponse.json({
    orders: result,
    currency: restaurant.currency,
    // La caja arma con esto sus métodos de cobro; antes asumía "PE".
    country: restaurant.country,
  });
}
