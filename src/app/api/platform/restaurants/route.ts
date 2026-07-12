import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { businessDayRange, getDb } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/auth";
import type { Restaurant } from "@/lib/types";

// Panel del dueño de la plataforma: alta, suspensión y mensualidad de cada
// restaurante. Todo requiere la clave de plataforma.

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT r.id, r.slug, r.name, r.currency, r.country, r.timezone, r.phone,
              r.active, r.plan, r.monthly_fee_cents, r.staff_pin, r.created_at,
              (SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = r.id) AS table_count,
              (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.id) AS item_count
       FROM restaurants r ORDER BY r.name`
    )
    .all() as (Restaurant & { table_count: number; item_count: number })[];

  // "Hoy" es el día local de cada restaurante, y cada uno puede tener su zona:
  // por eso las métricas del día se calculan local por local en vez de con un
  // date('now') en UTC compartido, que en Lima cambiaba de día a las 7 pm.
  const countToday = db.prepare(
    `SELECT COUNT(*) AS n FROM orders
     WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?`
  );
  const revenueToday = db.prepare(
    `SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders
     WHERE restaurant_id = ? AND payment_status = 'paid'
       AND created_at >= ? AND created_at < ?`
  );

  const restaurants = rows.map((r) => {
    const day = businessDayRange(r.timezone);
    const { n } = countToday.get(r.id, day.start, day.end) as { n: number };
    const { total } = revenueToday.get(r.id, day.start, day.end) as { total: number };
    return { ...r, orders_today: n, revenue_today_cents: total };
  });

  return NextResponse.json({ restaurants });
}

export async function POST(req: Request) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await req.json()) as {
    name?: string;
    slug?: string;
    staffPin?: string;
    adminPin?: string;
    timezone?: string;
    monthlyFeeCents?: number;
    tables?: number;
  };
  const db = getDb();

  const name = String(body.name ?? "").trim().slice(0, 80);
  const slug = String(body.slug || name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const pin = String(body.staffPin ?? "").trim();
  // Sin PIN de admin propio, el dueño usa el mismo que su equipo: se acepta para
  // no frenar el alta, pero conviene separarlos desde Admin → Seguridad.
  const adminPin = String(body.adminPin ?? "").trim() || pin;
  const timezone = String(body.timezone ?? "").trim() || "America/Lima";

  if (!name || !slug) {
    return NextResponse.json({ error: "Nombre y slug son obligatorios" }, { status: 400 });
  }
  if (!/^\d{4,6}$/.test(pin) || !/^\d{4,6}$/.test(adminPin)) {
    return NextResponse.json({ error: "El PIN debe tener 4 a 6 dígitos" }, { status: 400 });
  }
  if (db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(slug)) {
    return NextResponse.json({ error: "Ese slug ya está en uso" }, { status: 409 });
  }

  const fee = Math.floor(Number(body.monthlyFeeCents));
  const tableCount = Math.min(Math.max(Math.floor(Number(body.tables) || 6), 1), 60);
  const rid = randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO restaurants
         (id, slug, name, currency, country, timezone, active, plan, monthly_fee_cents,
          staff_pin, admin_pin, created_at)
       VALUES (?, ?, ?, 'PEN', 'PE', ?, 1, 'piloto', ?, ?, ?, datetime('now'))`
    ).run(
      rid,
      slug,
      name,
      timezone,
      Number.isFinite(fee) && fee >= 0 ? fee : 9900,
      pin,
      adminPin
    );

    const insertTable = db.prepare(
      "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)"
    );
    for (let i = 1; i <= tableCount; i++) {
      insertTable.run(randomUUID(), rid, String(i), `Mesa ${i}`);
    }
    // Categorías base para que el admin no arranque de cero.
    const insertCategory = db.prepare(
      "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)"
    );
    ["Entradas", "Platos de Fondo", "Bebidas", "Postres"].forEach((c, i) =>
      insertCategory.run(randomUUID(), rid, c, i)
    );
  })();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(rid) as Restaurant;
  return NextResponse.json({ restaurant }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await req.json()) as {
    id?: string;
    active?: boolean;
    monthlyFeeCents?: number;
  };
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(String(body.id ?? "")) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  if (typeof body.active === "boolean") {
    db.prepare("UPDATE restaurants SET active = ? WHERE id = ?").run(
      body.active ? 1 : 0,
      restaurant.id
    );
  }
  if (body.monthlyFeeCents !== undefined) {
    const fee = Math.floor(Number(body.monthlyFeeCents));
    if (!Number.isFinite(fee) || fee < 0) {
      return NextResponse.json({ error: "Mensualidad inválida" }, { status: 400 });
    }
    db.prepare("UPDATE restaurants SET monthly_fee_cents = ? WHERE id = ?").run(
      fee,
      restaurant.id
    );
  }

  const updated = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(restaurant.id);
  return NextResponse.json({ restaurant: updated });
}
