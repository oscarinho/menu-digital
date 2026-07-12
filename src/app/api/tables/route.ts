import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Restaurant, Table } from "@/lib/types";

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
