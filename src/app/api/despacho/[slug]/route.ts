import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buscarLocal, listarDespacho } from "@/domain/pedidos";

// La pantalla de despacho: PÚBLICA, sin PIN. Solo los números de pedido en preparación
// o listos del día. No devuelve platos, precios, mesas ni totales: cualquiera en la
// calle puede estar mirando esta TV, y lo único que puede leer es "el #12 ya está listo".
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDb();

  const restaurant = buscarLocal(db, slug);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    restaurant: {
      name: restaurant.name,
      logo: restaurant.logo,
      brandColor: restaurant.brand_color,
    },
    orders: listarDespacho(db, restaurant),
  });
}
