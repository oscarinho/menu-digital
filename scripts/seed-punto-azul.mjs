// Seed del restaurante Punto Azul (carta de día, julio 2026)
// Fuente: https://puntoazulrestaurante.com/carta-dia/
// Uso: node scripts/seed-punto-azul.mjs
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

const SLUG = "punto-azul";

// [categoría, [nombre, descripción, precio_centavos, emoji][]]
const MENU = [
  [
    "Nuevos",
    [
      ["Ensalada Oriental", "Mix de lechuga, col morada, holantao, frijolito chino y langostinos al panko", 3900, "🥗"],
      ["Wantán acevichado", "Pescado acevichado envuelto en wantán crocante con leche de tigre", 2700, "🥟"],
      ["Causa golf", "Masa de papa amarilla con palta y langostinos al panko en salsa golf", 3700, "🥔"],
      ["Ceviche crocante", "Bolitas de pescado acevichadas al panko con leche de tigre y guacamole", 5300, "🐟"],
      ["Rissocopa", "Arborio en salsa de ocopa, pulpos anticucheros y chips de papa amarilla", 6700, "🍚"],
      ["Timbal de mariscos", "Pasta corta en salsa de marisco gratinada con parmesano y mozzarella", 6900, "🦐"],
      ["Timbal de langostinos", "Pasta corta, langostinos y bechamel, gratinados con queso", 5300, "🦐"],
      ["Jardín de verano", "Jarabe de frutos rojos, jugo de naranja, zumo de limón y pepino", 1900, "🍹"],
      ["Tropical Ice", "Aguaymanto, maracuyá, crema de coco, canela y vainilla", 1900, "🍹"],
      ["Limonada Hawaiana", "Limonada con piña Golden y zumo de limón", 900, "🍋"],
      ["Mojito Criollo Tropical", "Pisco, hierba buena, maracuyá, mango y agua con gas", 2300, "🍸"],
      ["Flor amazónica", "Pisco Huamaní Italia, licor 43, copoazú, jamaica y crema de coco", 3800, "🌺"],
    ],
  ],
  [
    "Piqueos y Ensaladas",
    [
      ["Leche de tigre", "Concentrado fresco de ceviche", 3800, "🥛"],
      ["Conchitas a la parmesana (½ docena)", "Conchas de abanico gratinadas", 3700, "🐚"],
      ["Conchitas a la parmesana (docena)", "Conchas de abanico gratinadas", 6300, "🐚"],
      ["Pulpo al olivo", "Láminas de pulpo con crema de aceitunas botija", 5700, "🐙"],
      ["Pulpo emparrillado", "Pulpo en ensalada de papas con rocoto y huacatay", 7500, "🐙"],
      ["Wantán de pescado (½ docena)", "Pescado crocante en aceite de ajonjolí", 2500, "🥟"],
      ["Wantán de pescado (docena)", "Pescado crocante en aceite de ajonjolí", 4100, "🥟"],
      ["Tartar de salmón", "Salmón y cebollas con aceituna, palta y pan de ajo", 4900, "🍣"],
      ["Crocante de langostinos", "Langostinos al panko, leche de tigre de ají amarillo, palta y choclo", 3900, "🦐"],
      ["Ensalada de langostinos", "Lechugas con langostinos crocantes, palmitos, palta, tomate, tocino y camote", 3900, "🥗"],
      ["Poke de salmón", "Shari, mango, palta, cancha, lechuga, tomate, kiuri, salmón y wantán", 4300, "🍣"],
      ["Tortitas de choclo carretilleras", "Servidas con ceviche de pota", 3900, "🌽"],
    ],
  ],
  [
    "Ceviches y Tiraditos",
    [
      ["Tiraditos", "Tradicional, bicolor o tricolor: rocoto, parmesana, olivo, pesto o ají amarillo", 4900, "🐟"],
      ["Ceviche de pescado", "Pescado, sal, limón y ajíes", 5200, "🐟"],
      ["Ceviche mixto", "Pescado con mariscos", 5400, "🦑"],
      ["Ceviche de pescado y pulpo", "Pescado con láminas de pulpo", 5800, "🐙"],
      ["Ceviche de conchas negras", "10 unidades con culantrito y limo", 4700, "🐚"],
      ["Ceviche Punto Azul", "Pescado o mixto en salsa de rocoto", 5500, "🌶️"],
      ["Ceviche oriental de pescado", "Con aceite de ajonjolí y cebollita china", 5200, "🐟"],
      ["Ceviche oriental mixto", "Con aceite de ajonjolí y cebollita china", 5400, "🦑"],
      ["Ceviche criollo de pescado", "Con culantrito y ají limo", 5200, "🐟"],
      ["Ceviche criollo mixto", "Con culantrito y ají limo", 5400, "🦑"],
      ["Ceviche ahumado", "Pescado al ají amarillo, pulpo emparrillado, choclo, camote y palta", 5400, "🔥"],
    ],
  ],
  [
    "Chicharrones y Jaleas",
    [
      ["Chicharrón de pescado", "Con yuquitas fritas", 5300, "🍤"],
      ["Chicharrón mixto", "Langostino, calamar, pulpo y pescado con yuca", 6100, "🍤"],
      ["Chicharrón de langostinos", "Con yuca", 5400, "🦐"],
      ["Chicharrón de calamar", "Con choclo", 5900, "🦑"],
      ["Chicharrón de pescado con calamar", "Con yuca", 5800, "🍤"],
      ["Chicharrón de pescado con langostinos", "Con yuca", 5400, "🍤"],
    ],
  ],
  [
    "Causas",
    [
      ["Causa de langostinos", "Masa de papa amarilla con ají amarillo y limón", 3800, "🥔"],
      ["Causa de pescado", "Masa de papa amarilla con ají amarillo y limón", 3600, "🥔"],
      ["Causa de pulpo al olivo", "En salsa de olivo y mayonesa", 4500, "🐙"],
      ["Causa de pulpa de cangrejo", "Con mayonesa de la casa", 4400, "🦀"],
      ["Causa escabechada", "Escabeche de pescado sobre causa rellena", 4400, "🥔"],
      ["Causa acevichada", "Masa rellena de palta, salsa acevichada y ceviche de pescado", 5400, "🥔"],
    ],
  ],
  [
    "Pescados",
    [
      ["Pescado Punto Azul", "Relleno con jamón y queso. Elige 2 guarniciones", 5100, "🐟"],
      ["Pescado apanado", "Elige 2 guarniciones", 4500, "🐟"],
      ["Pescado a la plancha", "Elige 2 guarniciones", 4400, "🐟"],
      ["Pescado a lo macho", "En salsa a lo macho con mariscos", 6200, "🦐"],
    ],
  ],
  [
    "Pastas",
    [
      ["Spaghetti al pesto genovés", "Con langostinos", 4800, "🍝"],
      ["Spaghetti a lo Alfredo", "Con jamón y parmesano", 4400, "🍝"],
      ["Fettuccini a la huancaína", "Con langostinos al panko", 5300, "🍝"],
      ["Fettuccini a la huancaína con lomo saltado", "Al dente con lomo flambeado", 5800, "🥩"],
      ["Spaghetti al pesto acriollado con pescado apanado", "Con queso y leche", 5300, "🍝"],
    ],
  ],
  [
    "Arroces y Tacu Tacus",
    [
      ["Arroz con mariscos", "Atomatado con secretos del fundador", 5400, "🍚"],
      ["Arroz con langostinos", "Atamalado con langostinos", 5300, "🦐"],
      ["Arroz Punto Azul", "Al culantro con salsa cremosa de mariscos", 5400, "🍚"],
      ["Chaufa de pescado", "Al wok con capón", 4900, "🥡"],
      ["Chaufa de mariscos", "Al wok con capón", 5100, "🥡"],
      ["Risotto a la parmesana con langostinos", "Arborio al ají amarillo", 5300, "🍚"],
      ["Risotto a la parmesana con pescado", "Arborio al ají amarillo", 5100, "🍚"],
      ["Tacu tacu especial", "Arroz y frejoles con pescado apanado", 5400, "🫘"],
      ["Tacu tacu con salsa a lo macho", "Arroz y frejoles con salsa de mariscos", 6200, "🫘"],
      ["Tacu tacu con lomo saltado", "Con dados de lomo al wok", 5900, "🥩"],
      ["Aeropuerto montado", "Arroz frito, frejol y tallarín, montado con tortilla, chicharrón y palta", 5300, "🍳"],
    ],
  ],
  [
    "Sopas",
    [
      ["Sudado", "Pescado en caldo atomatado", 5100, "🍲"],
      ["Chupe de pescado", "Con zapallo, habas y queso fresco", 5200, "🍲"],
      ["Chupe de langostinos", "Con zapallo, habas y queso fresco", 5300, "🦐"],
      ["Parihuela", "Pescado y mariscos en caldo espeso de choros", 5500, "🍲"],
    ],
  ],
  [
    "Vegetarianos",
    [
      ["Chaufa de champiñones", "Champiñones al wok con capón", 4200, "🍄"],
      ["Arroz con champiñones", "Champiñones salteados con arroz atamalado", 4200, "🍄"],
      ["Risotto de champiñones", "Arborio, crema, champiñones, parmesano y espárragos", 4400, "🍄"],
    ],
  ],
  [
    "El Especial",
    [
      ["Lomo saltado", "Trozos de lomo flambeados al wok con pisco", 5500, "🥩"],
      ["Milanesa de pollo a la napolitana", "Con salsa de tomate, queso, jamón y pasta", 3900, "🍗"],
    ],
  ],
  [
    "Extras",
    [
      ["Camote glaseado", "", 1000, "🍠"],
      ["Choclo", "", 600, "🌽"],
      ["Puré", "", 1200, "🥔"],
      ["Arroz", "", 600, "🍚"],
      ["Yuca", "", 900, "🍟"],
      ["Ensalada", "", 1200, "🥗"],
      ["Pan al ajo", "", 900, "🍞"],
    ],
  ],
  [
    "Postres",
    [
      ["Torta de chocolate", "", 2600, "🍰"],
      ["Merengado de chirimoya", "", 2600, "🍰"],
      ["Suspiro limeño", "", 2600, "🍮"],
      ["Tres leches", "", 2600, "🍰"],
      ["Crema volteada", "", 2600, "🍮"],
    ],
  ],
  [
    "Bebidas",
    [
      ["Agua San Mateo / San Luis ½ L", "", 900, "💧"],
      ["Coca Cola ½ L", "", 900, "🥤"],
      ["Inca Kola ½ L", "", 900, "🥤"],
      ["Cusqueña", "", 1500, "🍺"],
      ["Pilsen", "", 1400, "🍺"],
      ["Cerveza artesanal Zatara", "", 1800, "🍺"],
      ["Jarra de chicha", "", 2300, "🍇"],
      ["Jarra de limonada", "", 2300, "🍋"],
      ["Jarra de maracuyá", "", 2300, "🧃"],
    ],
  ],
];

const run = db.transaction(() => {
  const existing = db
    .prepare("SELECT id FROM restaurants WHERE slug = ?")
    .get(SLUG);

  if (existing) {
    const rid = existing.id;
    db.prepare(
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)"
    ).run(rid);
    db.prepare("DELETE FROM orders WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM menu_items WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM categories WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM tables WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM sessions WHERE restaurant_id = ?").run(rid);
    db.prepare("DELETE FROM restaurants WHERE id = ?").run(rid);
    console.log("Restaurante existente eliminado, recargando…");
  }

  const rid = randomUUID();
  db.prepare(
    `INSERT INTO restaurants
       (id, slug, name, currency, country, phone, address, yape_number, plin_number,
        brand_color, active, plan, monthly_fee_cents, staff_pin, created_at)
     VALUES (?, ?, ?, 'PEN', 'PE', ?, ?, '', '', ?, 1, 'piloto', 9900, '1234', datetime('now'))`
  ).run(
    rid,
    SLUG,
    "Punto Azul",
    "",
    "Lima, Perú",
    "#0a5aa8"
  );

  const insertTable = db.prepare(
    "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)"
  );
  for (let i = 1; i <= 10; i++) {
    insertTable.run(randomUUID(), rid, String(i), `Mesa ${i}`);
  }

  const insertCategory = db.prepare(
    "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)"
  );
  const insertItem = db.prepare(
    `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price_cents, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
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

  console.log(`✔ Punto Azul creado: ${MENU.length} categorías, ${count} platos, 10 mesas`);
  console.log(`  Menú cliente:  /r/${SLUG}/mesa/1`);
  console.log(`  Admin:         /admin/${SLUG}  (PIN 1234)`);
  console.log(`  Cocina:        /cocina/${SLUG}`);
  console.log(`  Caja:          /caja/${SLUG}`);
});

run();
db.close();
