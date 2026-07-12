import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Category, Restaurant } from "@/lib/types";

interface CreateItemBody {
  restaurantSlug: string;
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  emoji?: string;
  image?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as CreateItemBody;
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

  const category = db
    .prepare("SELECT * FROM categories WHERE id = ? AND restaurant_id = ?")
    .get(body.categoryId, restaurant.id) as Category | undefined;
  if (!category) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const price = Math.floor(Number(body.priceCents));
  if (!name || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Nombre o precio inválido" }, { status: 400 });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price_cents, emoji, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    restaurant.id,
    category.id,
    name,
    String(body.description ?? "").slice(0, 300),
    price,
    String(body.emoji ?? "🍽️").slice(0, 8),
    String(body.image ?? "").slice(0, 200)
  );

  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
  return NextResponse.json({ item }, { status: 201 });
}
