// Seed de Lanzhou Noodles: segundo cliente de la demo, para enseñar el multitenant
// (misma app, otra marca, otra carta, otro idioma).
// Fuente: foto de la carta impresa del local (bilingüe chino/español, soles).
// Uso: node scripts/seed-lanzhou.mjs
// Idempotente: si el slug ya existe, borra su menú/mesas y lo vuelve a cargar.

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "menu.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SLUG = "lanzhou-noodles";
const NAME = "Lanzhou Noodles";
const BRAND = "#1f5c3d"; // el verde de la carta impresa

// La carta está en chino con la traducción debajo, y así la lee el local:
// name = chino (lo que canta la cocina), description = español (lo que pide el comensal).
// [categoría, [nombre, descripción, precio_centavos, emoji][]]
const MENU = [
  [
    "面食类 · Tallarines",
    [
      ["牛肉拉面", "Tallarín con carne estilo Lanzhou — el plato de la casa", 2500, "🍜"],
      ["红烧牛肉面", "Tallarín con carne estofada", 3000, "🍜"],
      ["酸菜牛肉面", "Tallarín con carne y col encurtida", 2600, "🍜"],
      ["牛肉刀削面", "Tallarín con carne, cortado a cuchillo", 2500, "🍜"],
      ["番茄鸡蛋面", "Tallarín con tomate y huevo", 2700, "🍜"],
    ],
  ],
  [
    "拌面类 · Tallarines mezclados",
    [
      ["土豆烧牛肉拌面", "Tallarín mezclado con carne y papas", 3000, "🍝"],
      ["葱爆牛肉拌面", "Tallarín mezclado con carne y cebolla", 3000, "🍝"],
      ["大盘鸡拌面", "Tallarín mezclado con pollo estilo «gran plato»", 3000, "🍝"],
      ["牛肉炒拉条（拉条子）", "Tallarín salteado con carne", 3000, "🍝"],
      ["番茄炒蛋拌面", "Tallarín mezclado con tomate y huevo", 3000, "🍝"],
      ["葱油拌面", "Tallarín con salsa de cebolla", 2000, "🍝"],
      ["红烧牛肉盖面", "Tallarín con carne estofada por encima", 3500, "🍝"],
      ["肉沫干拌面", "Tallarín seco con carne picada", 2000, "🍝"],
      ["孜然牛肉盖浇面", "Tallarín con carne al comino por encima", 3500, "🍝"],
      ["红烧鸡块面", "Tallarín con trozos de pollo estofado", 3000, "🍝"],
    ],
  ],
  [
    "炒饭类 · Arroz y chaufa",
    [
      ["酸菜牛肉炒饭", "Chaufa con carne y col encurtida", 2000, "🍚"],
      ["红烧牛肉盖饭", "Arroz con carne estofada", 3000, "🍚"],
      ["土豆牛肉盖饭", "Arroz con carne y papas", 2500, "🍚"],
      ["葱爆牛肉盖饭", "Arroz con carne salteada con cebolla", 2500, "🍚"],
      ["大盘鸡盖饭", "Arroz con pollo estilo «gran plato»", 2500, "🍚"],
      ["番茄炒蛋盖饭", "Arroz con tomate y huevo", 2000, "🍚"],
      ["孜然牛肉盖饭", "Arroz con carne al comino", 3000, "🍚"],
      ["红烧鸡块盖饭", "Arroz con trozos de pollo estofado", 2500, "🍚"],
    ],
  ],
  [
    "西北特色小炒 · Especialidades del Noroeste",
    [
      ["特色大盘鸡", "Pollo estilo «gran plato», especialidad de la casa (para compartir)", 9800, "🍗"],
      ["凉拌牛肉", "Ternera fría en rodajas", 3500, "🥩"],
      ["红烧牛肉", "Ternera estofada", 4000, "🥩"],
      ["孜然牛肉", "Ternera al comino", 4000, "🥩"],
      ["葱爆牛肉", "Ternera salteada con cebolla", 3000, "🥩"],
      ["青椒土豆丝", "Tiras de papa con pimiento verde", 2500, "🥔"],
      ["酸辣白菜", "Col agria picante", 2500, "🥬"],
      ["番茄炒蛋", "Tomate salteado con huevo", 2500, "🍅"],
    ],
  ],
  [
    "小吃类 · Bocadillos",
    [
      ["羊肉串", "Brocheta de cordero", 400, "🍢"],
      ["牛肉串", "Brocheta de res", 400, "🍢"],
      ["煎鸡蛋", "Huevo frito", 200, "🍳"],
    ],
  ],
];

const run = db.transaction(() => {
  const existing = db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(SLUG);
  if (existing) {
    const rid = existing.id;
    db.prepare(
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
    ).run(rid);
    db.prepare("DELETE FROM orders WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM menu_items WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM categories WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM tables WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM sessions WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM restaurants WHERE id = ?").run(rid);
    console.log("Restaurante existente eliminado, recargando…");
  }

  // admin_pin va explícito: la columna es DEFAULT '', y un local sin PIN de dueño
  // deja /admin cerrado para todos.
  const rid = randomUUID();
  db.prepare(
    `INSERT INTO restaurants
       (id, slug, name, currency, country, phone, address, yape_number, plin_number,
        brand_color, active, plan, monthly_fee_cents, staff_pin, admin_pin, timezone, created_at)
     VALUES (?, ?, ?, 'PEN', 'PE', '', ?, ?, ?, ?, 1, 'piloto', 9900, '1234', '1234',
             'America/Lima', datetime('now'))`,
  ).run(rid, SLUG, NAME, "Lima, Perú", "987 654 321", "987 654 321", BRAND);

  const insertTable = db.prepare(
    "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)",
  );
  for (let i = 1; i <= 10; i++) insertTable.run(randomUUID(), rid, String(i), `Mesa ${i}`);

  const insertCategory = db.prepare(
    "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)",
  );
  const insertItem = db.prepare(
    `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price_cents, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  let count = 0;
  MENU.forEach(([categoryName, items], i) => {
    const cid = randomUUID();
    insertCategory.run(cid, rid, categoryName, i);
    for (const [name, description, price, emoji] of items) {
      insertItem.run(randomUUID(), rid, cid, name, description, price, emoji);
      count++;
    }
  });

  console.log(`✔ ${NAME}: ${MENU.length} categorías, ${count} platos, 10 mesas`);
  console.log(`  Menú cliente:  /r/${SLUG}/mesa/1`);
  console.log(`  Cocina:        /cocina/${SLUG}   (PIN personal 1234)`);
  console.log(`  Caja:          /caja/${SLUG}`);
  console.log(`  Admin:         /admin/${SLUG}    (PIN dueño 1234)`);
});

run();
db.close();
