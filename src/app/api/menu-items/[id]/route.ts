import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { MenuItem } from "@/lib/types";

interface UpdateItemBody {
  available?: boolean;
  priceCents?: number;
  name?: string;
  description?: string;
  image?: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as UpdateItemBody;
  const db = getDb();

  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as
    | MenuItem
    | undefined;
  if (!item) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(item.restaurant_id, "admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (typeof body.available === "boolean") {
    db.prepare("UPDATE menu_items SET available = ? WHERE id = ?").run(
      body.available ? 1 : 0,
      id
    );
  }
  if (body.priceCents !== undefined) {
    const price = Math.floor(Number(body.priceCents));
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }
    db.prepare("UPDATE menu_items SET price_cents = ? WHERE id = ?").run(price, id);
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 120);
    if (!name) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    }
    db.prepare("UPDATE menu_items SET name = ? WHERE id = ?").run(name, id);
  }
  if (body.description !== undefined) {
    db.prepare("UPDATE menu_items SET description = ? WHERE id = ?").run(
      String(body.description).slice(0, 300),
      id
    );
  }
  if (body.image !== undefined) {
    db.prepare("UPDATE menu_items SET image = ? WHERE id = ?").run(
      String(body.image).slice(0, 200),
      id
    );
  }

  const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as
    | MenuItem
    | undefined;
  if (!item) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(item.restaurant_id, "admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Los pedidos pasados guardan snapshot de nombre/precio, así que borrar el
  // producto no daña el historial; solo se bloquea si hay líneas que lo
  // referencian (FK) — en ese caso lo marcamos agotado.
  try {
    db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  } catch {
    db.prepare("UPDATE menu_items SET available = 0 WHERE id = ?").run(id);
    return NextResponse.json({
      softDeleted: true,
      message: "Tiene pedidos asociados: se marcó como agotado",
    });
  }
  return NextResponse.json({ ok: true });
}
