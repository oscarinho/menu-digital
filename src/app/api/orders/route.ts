import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  ErrorDePedido,
  buscarLocal,
  buscarMesa,
  crearPedido,
  listarPedidos,
  type LineaPedida,
  type Vista,
} from "@/domain/pedidos";

interface CreateOrderBody {
  restaurantSlug: string;
  // Ausente en el pedido de mostrador: ese QR no trae mesa.
  tableCode?: string;
  paymentMethod?: string;
  notes?: string;
  customerName?: string;
  items: LineaPedida[];
}

// El comensal no se autentica (y así debe ser), pero sin límite un script podría
// inundar la cocina de comandas falsas. Una mesa real no pide 3 veces por minuto.
const MAX_ORDERS = 3;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const body = (await req.json()) as CreateOrderBody;
  const db = getDb();

  const restaurant = buscarLocal(db, body.restaurantSlug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  // Con código de mesa es un pedido de salón; sin él, uno de mostrador. Un local en
  // modo 'salon' no recibe pedidos sin mesa: su QR siempre trae una.
  let table = null;
  if (body.tableCode) {
    table = buscarMesa(db, restaurant.id, body.tableCode);
    if (!table) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }
  } else if (restaurant.service_mode === "salon") {
    return NextResponse.json(
      { error: "Este local solo recibe pedidos desde la mesa" },
      { status: 400 }
    );
  }

  const limit = rateLimit(
    `order:${clientIp(req)}:${restaurant.id}:${table ? table.id : "mostrador"}`,
    MAX_ORDERS,
    WINDOW_MS
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Ya enviaste varios pedidos seguidos. Espera ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const pedido = crearPedido(db, restaurant, table, {
      items: body.items,
      notes: body.notes,
      paymentMethod: body.paymentMethod,
      customerName: body.customerName,
    });
    return NextResponse.json(pedido, { status: 201 });
  } catch (e) {
    if (e instanceof ErrorDePedido) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// Listado de pedidos para cocina, caja y salón. Solo personal del restaurante.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const vista = (searchParams.get("view") ?? "kitchen") as Vista;
  const db = getDb();

  const restaurant = buscarLocal(db, slug ?? "");
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(restaurant.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { orders, tables } = listarPedidos(db, restaurant, vista);

  return NextResponse.json({
    orders,
    currency: restaurant.currency,
    // La caja arma con esto sus métodos de cobro; antes asumía "PE".
    country: restaurant.country,
    // La cabecera de cocina, caja y salón enseñaba el slug ("punto-azul"): un
    // residuo de programador en la pantalla que mira el cocinero. Con esto enseña
    // la casa donde trabaja.
    restaurant: {
      name: restaurant.name,
      logo: restaurant.logo,
      brandColor: restaurant.brand_color,
      // La barra del local esconde la pestaña de Salón cuando el modo es despacho.
      serviceMode: restaurant.service_mode,
    },
    tables,
  });
}
