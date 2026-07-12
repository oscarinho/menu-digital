import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Restaurant } from "@/lib/types";

// Crear categoría de menú. Solo staff del restaurante.
export async function POST(req: Request) {
  const body = (await req.json()) as { restaurantSlug: string; name: string };
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

  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const { maxOrder } = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM categories WHERE restaurant_id = ?"
    )
    .get(restaurant.id) as { maxOrder: number };

  const id = randomUUID();
  db.prepare(
    "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)"
  ).run(id, restaurant.id, name, maxOrder + 1);

  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  return NextResponse.json({ category }, { status: 201 });
}
