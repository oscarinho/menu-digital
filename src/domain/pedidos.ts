import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { businessDayRange } from "@/lib/db";
import type {
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  OrderWithDetails,
  Restaurant,
  Table,
} from "@/lib/types";

// El pedido: crearlo, listarlo para cada pantalla del local, moverlo de estado y
// cobrarlo. Aquí vive la regla; la ruta HTTP de al lado solo traduce a JSON.
//
// Nada de esto sabe de Request, de cookies ni de NextResponse — por eso se puede
// probar contra una base temporal, que es lo que impide que un día un local
// empiece a ver los pedidos de otro sin que nadie se entere.

// Un pedido no puede tener más líneas que esto: si llegan más, algo va mal.
export const MAX_LINEAS = 40;

/** Error con el código HTTP que le corresponde. La ruta lo traduce y ya. */
export class ErrorDePedido extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ErrorDePedido";
  }
}

export const ESTADOS_VALIDOS: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

/** Qué pedidos quiere ver cada pantalla. */
export type Vista = "kitchen" | "caja" | "salon" | "day";

export interface LineaPedida {
  id: string;
  quantity: number;
  notes?: string;
}

export interface NuevoPedido {
  items: LineaPedida[];
  notes?: string;
  paymentMethod?: string;
  /** Nombre con el que se llama al cliente de mostrador. Se ignora en pedidos de mesa. */
  customerName?: string;
}

export function buscarLocal(db: Database.Database, slug: string): Restaurant | undefined {
  return db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug) as
    | Restaurant
    | undefined;
}

export function buscarMesa(
  db: Database.Database,
  restaurantId: string,
  code: string
): Table | undefined {
  return db
    .prepare("SELECT * FROM tables WHERE restaurant_id = ? AND code = ?")
    .get(restaurantId, code) as Table | undefined;
}

/**
 * Crea el pedido y le da su número del día.
 *
 * El precio se lee de la carta, nunca del cliente: el navegador manda qué platos
 * y cuántos, y el total lo hace el servidor. Si un plato no es de este local o
 * está agotado, el pedido entero se cae.
 *
 * `table` en null es un pedido de mostrador (origin='mostrador'): no salió de
 * ninguna mesa y lo recoge el propio comensal cuando la cocina lo canta.
 */
export function crearPedido(
  db: Database.Database,
  restaurant: Restaurant,
  table: Table | null,
  entrada: NuevoPedido
): { id: string; dailyNumber: number; totalCents: number } {
  if (!restaurant.active) {
    throw new ErrorDePedido(403, "Este restaurante no está recibiendo pedidos por ahora");
  }
  if (!Array.isArray(entrada.items) || entrada.items.length === 0) {
    throw new ErrorDePedido(400, "El pedido está vacío");
  }
  if (entrada.items.length > MAX_LINEAS) {
    throw new ErrorDePedido(
      400,
      `Un pedido no puede tener más de ${MAX_LINEAS} productos distintos`
    );
  }

  // El plato tiene que ser de ESTE local: sin este filtro, mandar el id de un
  // plato del local de al lado colaría su precio en esta cuenta.
  const getItem = db.prepare(
    "SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ? AND available = 1"
  );

  const lines: { item: MenuItem; quantity: number; notes: string }[] = [];
  for (const line of entrada.items) {
    const quantity = Math.floor(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      throw new ErrorDePedido(400, "Cantidad inválida");
    }
    const item = getItem.get(line.id, restaurant.id) as MenuItem | undefined;
    if (!item) {
      throw new ErrorDePedido(409, "Un producto del pedido ya no está disponible");
    }
    lines.push({ item, quantity, notes: String(line.notes ?? "").slice(0, 300) });
  }

  const total = lines.reduce((sum, l) => sum + l.item.price_cents * l.quantity, 0);
  const orderId = randomUUID();
  // "Hoy" es el día del local, no el de UTC: en Lima el día UTC cambia a las
  // 7 pm y el número de pedido se reiniciaría a #1 en plena cena.
  const day = businessDayRange(restaurant.timezone);

  const dailyNumber = db.transaction(() => {
    const { n } = db
      .prepare(
        `SELECT COUNT(*) AS n FROM orders
         WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`
      )
      .get(restaurant.id, day.start, day.end) as { n: number };

    // Sin mesa es un pedido de mostrador que recoge el propio comensal; con mesa,
    // el flujo de siempre (lo lleva el mozo). El modo del local afina esto en 1C;
    // por ahora lo decide, sin ambigüedad, si vino o no una mesa.
    const origin = table ? "mesa" : "mostrador";
    const delivery = table ? "mozo" : "recojo";

    db.prepare(
      `INSERT INTO orders (id, restaurant_id, table_id, daily_number, status, notes, payment_method, total_cents, origin, delivery, customer_name)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      restaurant.id,
      table ? table.id : null,
      n + 1,
      String(entrada.notes ?? "").slice(0, 500),
      String(entrada.paymentMethod ?? ""),
      total,
      origin,
      delivery,
      // El nombre solo tiene sentido sin mesa: la mesa ya nombra al pedido de salón.
      table ? "" : String(entrada.customerName ?? "").trim().slice(0, 60)
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
  })();

  return { id: orderId, dailyNumber, totalCents: total };
}

/**
 * Los pedidos que le tocan a cada pantalla del local.
 *
 * Cocina y caja no solo trabajan lo que tienen delante: también necesitan ver lo
 * que ya cerraron hoy ("¿la mesa 4 ya salió?", "¿cuánto llevamos cobrado?"). Cada
 * vista devuelve lo abierto —sin límite de día: un pedido de anoche sin cobrar
 * sigue pendiente— más lo cerrado dentro del día del local.
 *
 * Lo cerrado se acota por updated_at (cuándo se entregó o se cobró), no por
 * created_at: en un local que sirve pasada la medianoche, el pedido que se toma a
 * las 23:55 y se cobra a las 00:05 se le desaparecería a la caja en el momento de
 * cobrarlo, que es justo lo que no queremos.
 */
export function listarPedidos(
  db: Database.Database,
  restaurant: Restaurant,
  vista: Vista
): { orders: OrderWithDetails[]; tables?: Table[] } {
  const day = businessDayRange(restaurant.timezone);
  const args: unknown[] = [restaurant.id];
  let where: string;

  if (vista === "kitchen") {
    where = `(o.status IN ('pending','preparing','ready')
              OR (o.status = 'delivered' AND o.updated_at >= ? AND o.updated_at < ?))`;
    args.push(day.start, day.end);
  } else if (vista === "caja") {
    where = `((o.payment_status != 'paid' AND o.status != 'cancelled')
              OR (o.payment_status = 'paid' AND o.updated_at >= ? AND o.updated_at < ?))`;
    args.push(day.start, day.end);
  } else if (vista === "salon") {
    // El estado de la mesa se deduce de sus pedidos, no se guarda. Van los vivos
    // (que la ocupan) y también las cuentas cerradas hoy: pagar no libera la mesa
    // —el comensal sigue sentado—, así que el salón necesita saber cuándo se cerró
    // la cuenta para compararlo con la última vez que alguien recogió la mesa.
    where = `o.status != 'cancelled'
             AND (NOT (o.status = 'delivered' AND o.payment_status = 'paid')
                  OR (o.updated_at >= ? AND o.updated_at < ?))`;
    args.push(day.start, day.end);
  } else {
    where = "o.created_at >= ? AND o.created_at < ?";
    args.push(day.start, day.end);
  }

  // LEFT JOIN, no JOIN: el pedido de mostrador no tiene mesa, y con un JOIN normal
  // desaparecería de la cocina y de la caja —justo los pedidos que no queremos perder.
  const orders = db
    .prepare(
      `SELECT o.*, t.code AS table_code, t.label AS table_label
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.restaurant_id = ? AND ${where}
       ORDER BY o.created_at ASC`
    )
    .all(...args) as (Order & { table_code: string | null; table_label: string | null })[];

  const getItems = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  const result: OrderWithDetails[] = orders.map((o) => ({
    ...o,
    items: getItems.all(o.id) as OrderItem[],
  }));

  return {
    orders: result,
    // El mapa del salón necesita también las mesas vacías, que por definición no
    // tienen ningún pedido que las traiga en la consulta de arriba.
    tables:
      vista === "salon"
        ? (db
            .prepare("SELECT * FROM tables WHERE restaurant_id = ?")
            .all(restaurant.id) as Table[])
        : undefined,
  };
}

export interface LineaDespacho {
  daily_number: number;
  status: OrderStatus;
  customer_name: string;
}

/**
 * Lo que canta la pantalla de despacho (la TV del local): solo los pedidos en
 * preparación o listos del día, y de cada uno solo el número, el estado y el nombre.
 *
 * Nada de platos, precios ni mesas: esta pantalla es PÚBLICA, sin PIN, colgada a la
 * vista de toda la calle. Lo único que se puede leer ahí es "el #12 ya está listo".
 */
export function listarDespacho(db: Database.Database, restaurant: Restaurant): LineaDespacho[] {
  const day = businessDayRange(restaurant.timezone);
  return db
    .prepare(
      `SELECT daily_number, status, customer_name FROM orders
       WHERE restaurant_id = ? AND status IN ('preparing','ready')
         AND created_at >= ? AND created_at < ?
       ORDER BY ready_at = '' DESC, daily_number ASC`
    )
    .all(restaurant.id, day.start, day.end) as LineaDespacho[];
}

/** El pedido que sigue el comensal desde su celular, con el local que lo cocina. */
export function verPedido(
  db: Database.Database,
  id: string
): { order: OrderWithDetails; restaurant: Restaurant } | undefined {
  const order = db
    .prepare(
      `SELECT o.*, t.code AS table_code, t.label AS table_label
       FROM orders o LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.id = ?`
    )
    .get(id) as (Order & { table_code: string | null; table_label: string | null }) | undefined;
  if (!order) return undefined;

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(id) as OrderItem[];
  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(order.restaurant_id) as Restaurant;

  return { order: { ...order, items }, restaurant };
}

export function buscarPedido(db: Database.Database, id: string): Order | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

/**
 * "Ya pagué con Yape/Plin" — lo dice el comensal, sin PIN, y por eso es la única
 * acción pública sobre un pedido. Solo mueve unpaid → claimed: quien confirma que
 * la plata llegó de verdad es la caja. Repetirlo no cambia nada.
 */
export function informarPago(db: Database.Database, id: string): Order | undefined {
  const order = buscarPedido(db, id);
  if (!order) return undefined;
  if (order.payment_status === "unpaid") {
    db.prepare(
      "UPDATE orders SET payment_status = 'claimed', updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  }
  return buscarPedido(db, id);
}

/** La cocina mueve el pedido: pendiente → preparando → listo → entregado. */
export function cambiarEstado(
  db: Database.Database,
  id: string,
  status: OrderStatus
): Order | undefined {
  if (!ESTADOS_VALIDOS.includes(status)) {
    throw new ErrorDePedido(400, "Estado inválido");
  }
  // La hora del cruce se sella una sola vez. Si el pedido vuelve a 'ready' por un toque
  // repetido, no se pisa el primer instante: los tiempos de cocina mentirían si cada
  // clic reiniciara el reloj.
  const sello =
    status === "ready"
      ? ", ready_at = CASE WHEN ready_at = '' THEN datetime('now') ELSE ready_at END"
      : status === "delivered"
        ? ", delivered_at = CASE WHEN delivered_at = '' THEN datetime('now') ELSE delivered_at END"
        : "";
  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now')${sello} WHERE id = ?`
  ).run(status, id);
  return buscarPedido(db, id);
}

/** La caja confirma que el cobro entró, y con qué método. */
export function registrarCobro(
  db: Database.Database,
  id: string,
  method: string
): Order | undefined {
  db.prepare(
    `UPDATE orders SET payment_status = 'paid', payment_method = ?,
     updated_at = datetime('now') WHERE id = ?`
  ).run(String(method), id);
  return buscarPedido(db, id);
}
