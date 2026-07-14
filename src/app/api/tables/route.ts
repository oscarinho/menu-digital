import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Restaurant, Table } from "@/lib/types";

// "Liberar mesa": el mozo la recogió y se fueron. Es la única señal que la app no
// puede deducir —pagar no vacía la mesa— y por eso se la pedimos a la única persona
// que la tiene. Basta el PIN del personal: recoger una mesa no es administrar nada.
export async function PATCH(req: Request) {
  const body = (await req.json()) as { restaurantSlug: string; tableId: string };
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(body.restaurantSlug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(restaurant.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // La mesa tiene que ser de ESTE local: con la sesión de un restaurante no se toca
  // el salón de otro.
  const table = db
    .prepare("SELECT * FROM tables WHERE id = ? AND restaurant_id = ?")
    .get(body.tableId, restaurant.id) as Table | undefined;
  if (!table) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  db.prepare("UPDATE tables SET freed_at = datetime('now') WHERE id = ?").run(table.id);
  return NextResponse.json({
    table: db.prepare("SELECT * FROM tables WHERE id = ?").get(table.id),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { restaurantSlug: string; code: string; label?: string };
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(body.restaurantSlug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(restaurant.id, "admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const code = String(body.code ?? "").trim().slice(0, 20);
  if (!code) {
    return NextResponse.json({ error: "Código de mesa inválido" }, { status: 400 });
  }

  const existing = db
    .prepare("SELECT id FROM tables WHERE restaurant_id = ? AND code = ?")
    .get(restaurant.id, code) as Table | undefined;
  if (existing) {
    return NextResponse.json({ error: "Ya existe una mesa con ese código" }, { status: 409 });
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)"
  ).run(id, restaurant.id, code, String(body.label ?? `Mesa ${code}`).slice(0, 60));

  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(id);
  return NextResponse.json({ table }, { status: 201 });
}
