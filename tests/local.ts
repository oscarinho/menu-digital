import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";
import { openDb } from "@/lib/db";
import type { Restaurant, Table } from "@/lib/types";

// Un local de mentira sobre una base de verdad.
//
// Los tests no simulan SQLite: abren una base temporal, le pasan las mismas
// migraciones que corren en producción y siembran locales con la misma forma. Si
// una migración rompe algo, se rompe aquí antes que en el local del cliente.

export interface LocalDePrueba {
  restaurant: Restaurant;
  mesas: Table[];
  /** Platos por nombre, para pedirlos sin andar buscando ids. */
  platos: Record<string, { id: string; price_cents: number }>;
}

/** Base temporal, migrada y vacía. Se borra sola al terminar el proceso. */
export function baseTemporal(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vectaryx-test-"));
  const db = openDb(path.join(dir, "menu.db"));
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  return db;
}

/**
 * Siembra un local con sus mesas y su carta.
 *
 * `timezone` importa más de lo que parece: es lo que decide qué es "hoy" para el
 * número de pedido y para todo lo que la caja cuadra al cerrar.
 */
export function sembrarLocal(
  db: Database.Database,
  opciones: {
    slug: string;
    nombre?: string;
    timezone?: string;
    activo?: boolean;
    mesas?: string[];
    carta?: { nombre: string; precio: number; disponible?: boolean }[];
  }
): LocalDePrueba {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO restaurants
       (id, slug, name, currency, country, timezone, active, plan, monthly_fee_cents,
        staff_pin, admin_pin, created_at)
     VALUES (?, ?, ?, 'PEN', 'PE', ?, ?, 'piloto', 9900, '1234', '9999', datetime('now'))`
  ).run(
    id,
    opciones.slug,
    opciones.nombre ?? opciones.slug,
    opciones.timezone ?? "America/Lima",
    opciones.activo === false ? 0 : 1
  );

  const insertMesa = db.prepare(
    "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)"
  );
  const mesas: Table[] = [];
  for (const code of opciones.mesas ?? ["1", "2", "3"]) {
    const mesaId = randomUUID();
    insertMesa.run(mesaId, id, code, `Mesa ${code}`);
    mesas.push(db.prepare("SELECT * FROM tables WHERE id = ?").get(mesaId) as Table);
  }

  const categoriaId = randomUUID();
  db.prepare(
    "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, 'Carta', 0)"
  ).run(categoriaId, id);

  const insertPlato = db.prepare(
    `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price_cents, available)
     VALUES (?, ?, ?, ?, '', ?, ?)`
  );
  const platos: LocalDePrueba["platos"] = {};
  for (const p of opciones.carta ?? [{ nombre: "Ceviche", precio: 3500 }]) {
    const platoId = randomUUID();
    insertPlato.run(platoId, id, categoriaId, p.nombre, p.precio, p.disponible === false ? 0 : 1);
    platos[p.nombre] = { id: platoId, price_cents: p.precio };
  }

  return {
    restaurant: db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id) as Restaurant,
    mesas,
    platos,
  };
}

/**
 * Reescribe cuándo se creó y cuándo se tocó por última vez un pedido.
 *
 * SQLite pone la fecha sola, y "ayer" no se puede esperar sentado: para probar que
 * el pedido de anoche no cuenta como de hoy, hay que poder mandarlo a anoche.
 */
export function fecharPedido(
  db: Database.Database,
  id: string,
  cuando: { creado?: string; tocado?: string }
): void {
  if (cuando.creado) {
    db.prepare("UPDATE orders SET created_at = ? WHERE id = ?").run(cuando.creado, id);
  }
  if (cuando.tocado) {
    db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(cuando.tocado, id);
  }
}
