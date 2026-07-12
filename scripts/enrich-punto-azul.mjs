// Enriquece el tenant punto-azul con ingredientes y descripción ampliada
// (para la tarjeta expandible) y agrega las secciones de barra del PDF
// cartadia_esp.pdf (Piscos y Cócteles, Mocktails).
// No destructivo: hace UPDATE por nombre e INSERT solo de lo que falte,
// así conserva las fotos ya asignadas.
// Uso: node scripts/enrich-punto-azul.mjs

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";

const SLUG = "punto-azul";
const db = new Database(path.join(process.cwd(), "data", "menu.db"));
db.pragma("foreign_keys = ON");

// Columnas nuevas (defensivo: por si el server aún no corrió la migración).
function addColumn(table, column, def) {
  const cols = db.pragma(`table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
addColumn("menu_items", "detail", "TEXT NOT NULL DEFAULT ''");
addColumn("menu_items", "ingredients", "TEXT NOT NULL DEFAULT ''");

const r = db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(SLUG);
if (!r) {
  console.error("Primero corre: node scripts/seed-punto-azul.mjs");
  process.exit(1);
}
const rid = r.id;

// nombre del plato → [ingredientes (chips "emoji etiqueta" | separados), detalle ampliado]
// El detalle se toma de cartadia_esp.pdf cuando aporta más que la descripción corta.
const ENRICH = {
  // ── Nuevos ──
  "Ensalada Oriental": ["🥬 Lechuga|🥗 Col morada|🌱 Holantao|🫛 Frijolito chino|🦐 Langostinos", "Acompañada de aliño oriental. Autor: Jordan Cortijo."],
  "Wantán acevichado": ["🐟 Pescado|🥟 Wantán|🍋 Leche de tigre", "Pescado acevichado envuelto en wantán crocante, acompañado con leche de tigre. Autores: Scooth Yarma, Juvenal Flores y Francisco Centeno."],
  "Causa golf": ["🥔 Papa amarilla|🥑 Palta|🦐 Langostinos|🥫 Salsa golf", "Masa de papa amarilla coronada con láminas de palta, acompañada de langostinos al panko envueltos en nuestra secreta salsa golf. Autor: Pablo Tarazona."],
  "Ceviche crocante": ["🐟 Pescado|🍞 Panko|🍋 Leche de tigre|🥑 Guacamole", "Crocantes bolitas de pescado acevichadas al panko, acompañadas de leche de tigre y guacamole. Autor: Heinz Acevedo."],
  "Rissocopa": ["🍚 Arborio|🌶️ Ocopa|🐙 Pulpo|🥔 Papa amarilla", "Cremoso arborio en salsa de ocopa, pulpos anticucheros, chips de papa amarilla y toques de uchucuta. Autor: Sebastián Molina."],
  "Timbal de mariscos": ["🍝 Pasta corta|🦑 Mariscos|🧀 Parmesano|🧀 Mozzarella", "Pasta corta bañada en salsa de marisco, gratinada con parmesano y mozzarella. Autora: Mirella Garay."],
  "Timbal de langostinos": ["🍝 Pasta corta|🦐 Langostinos|🥛 Bechamel|🧀 Queso", "Pasta corta con langostinos y bechamel, gratinados con parmesano y mozzarella. Autores: Vinancio Ynca y Kevin Vargas."],
  "Jardín de verano": ["🫐 Frutos rojos|🍊 Naranja|🍋 Limón|🥒 Pepino", "Jarabe de frutos rojos, jugo de naranja, zumo de limón y zumo de pepino kiuri. Autor: Jairo Daga."],
  "Tropical Ice": ["🟠 Aguaymanto|🟡 Maracuyá|🥥 Crema de coco|🌰 Canela", "Aguaymanto, maracuyá, crema de coco, canela y vainilla. Autores: Ítalo Sevilla y Enrique Carranza."],
  "Limonada Hawaiana": ["🍋 Limón|🍍 Piña Golden", "Limonada a base de piña Golden y zumo de limón. Autores: José Núñez y Juan Capcha."],
  "Mojito Criollo Tropical": ["🥃 Pisco|🌿 Hierba buena|🟡 Maracuyá|🥭 Mango", "Pisco, hierba buena, zumo de maracuyá, zumo de mango y agua con gas. Autor: Juan Carlos Castillo."],
  "Flor amazónica": ["🥃 Pisco Italia|🍯 Licor 43|🟤 Copoazú|🌺 Jamaica", "Pisco Huamaní Italia, licor 43, copoazú, flor de Jamaica y crema de coco. Autores: Enrique Carranza e Ítalo Sevilla."],

  // ── Piqueos y Ensaladas ──
  "Leche de tigre": ["🐟 Pescado|🍋 Limón|🌶️ Ají|🌽 Cancha", "Fresco e irresistible concentrado de nuestro ceviche. ¡Tu mejor forma de empezar!"],
  "Conchitas a la parmesana (½ docena)": ["🐚 Conchas de abanico|🧀 Parmesano", "Conchas de abanico gratinadas con queso parmesano."],
  "Conchitas a la parmesana (docena)": ["🐚 Conchas de abanico|🧀 Parmesano", "Conchas de abanico gratinadas con queso parmesano."],
  "Pulpo al olivo": ["🐙 Pulpo|🫒 Aceituna botija|🍋 Limón", "Láminas de pulpo sazonadas con limón y crema de aceitunas botija."],
  "Pulpo emparrillado": ["🐙 Pulpo|🥔 Papa|🌶️ Rocoto|🌿 Huacatay", "Sabrosísimo pulpo con ensalada de papas, rocoto y huacatay."],
  "Wantán de pescado (½ docena)": ["🐟 Pescado|🥟 Wantán|🫙 Ajonjolí", "Pescado en aceite de ajonjolí envuelto en wantán crocante."],
  "Wantán de pescado (docena)": ["🐟 Pescado|🥟 Wantán|🫙 Ajonjolí", "Pescado en aceite de ajonjolí envuelto en wantán crocante."],
  "Tartar de salmón": ["🍣 Salmón|🥑 Palta|🫙 Ajonjolí|🍞 Pan al ajo", "Salmón fresco en cubos con trocitos de palta, leche de tigre y semillas de ajonjolí tostado. Con 4 panes al ajo de la casa."],
  "Crocante de langostinos": ["🦐 Langostinos|🍞 Panko|🌶️ Ají amarillo|🌽 Choclo", "Langostinos al panko, leche de tigre de ají amarillo, palta, choclo y chalaquita."],
  "Ensalada de langostinos": ["🦐 Langostinos|🥬 Lechuga|🌴 Palmitos|🥑 Palta|🥓 Tocino", "Fresca mezcla de lechugas con langostinos crocantes, palmitos, palta, tomate cherry, tocino y camote, con vinagreta de mostaza."],
  "Poke de salmón": ["🍚 Shari|🥭 Mango|🥑 Palta|🍣 Salmón", "Shari, mango, palta, cancha, lechuga, tomate cherry, zanahoria, kiuri, salmón, wantán frito y salsa acevichada de la casa."],
  "Tortitas de choclo carretilleras": ["🌽 Choclo|🦑 Pota", "Tortitas de choclo servidas con ceviche de pota."],

  // ── Ceviches y Tiraditos ──
  "Tiraditos": ["🐟 Pescado|🌶️ Rocoto|🧀 Parmesana|🫒 Olivo", "Pruébalos en tradicional, bicolor o tricolor: al rocoto, parmesana, olivo, pesto y ají amarillo. Toda una experiencia culinaria."],
  "Ceviche de pescado": ["🐟 Pescado|🍋 Limón|🌶️ Ají|🧅 Cebolla", "Pescado, sal, limón y ajíes. Emblema de nuestra cocina peruana."],
  "Ceviche mixto": ["🐟 Pescado|🦑 Mariscos|🍋 Limón", "Nuestro ceviche de pescado con mariscos."],
  "Ceviche de pescado y pulpo": ["🐟 Pescado|🐙 Pulpo|🍋 Limón", "Tradicional ceviche acompañado de tiernas láminas de pulpo."],
  "Ceviche de conchas negras": ["🐚 Conchas negras|🌿 Culantro|🌶️ Ají limo", "10 unidades de frescas y jugosas conchas negras con toques de culantrito y limón."],
  "Ceviche Punto Azul": ["🐟 Pescado|🌶️ Rocoto|🍋 Limón", "De pescado o mixto, bañado en una deliciosa salsa de rocoto."],
  "Ceviche oriental de pescado": ["🐟 Pescado|🫙 Ajonjolí|🌱 Cebollita china", "Ceviche que rinde homenaje a la cultura Nikkei, con toques de aceite de ajonjolí y cebollita china."],
  "Ceviche oriental mixto": ["🦑 Mariscos|🫙 Ajonjolí|🌱 Cebollita china", "Versión mixta del ceviche Nikkei, con aceite de ajonjolí y cebollita china."],
  "Ceviche criollo de pescado": ["🐟 Pescado|🌿 Culantro|🌶️ Ají limo", "Inspirado en los sabores de la Lima antigua, aromatizado con culantrito y ají limo."],
  "Ceviche criollo mixto": ["🦑 Mariscos|🌿 Culantro|🌶️ Ají limo", "Versión mixta, inspirada en los sabores de la Lima antigua con culantrito y ají limo."],
  "Ceviche ahumado": ["🐟 Pescado|🌶️ Ají amarillo|🐙 Pulpo|🥔 Camote", "Pescado al ají amarillo flambeado al wok, pulpo emparrillado, choclo, camote glaseado y palta rostizada."],

  // ── Chicharrones y Jaleas ──
  "Chicharrón de pescado": ["🐟 Pescado|🍟 Yuca", "Crocante, caliente y sabroso, acompañado de yuquitas fritas."],
  "Chicharrón mixto": ["🦐 Langostino|🦑 Calamar|🐙 Pulpo|🐟 Pescado", "Original o como jalea, con langostino, calamar, pulpo y pescado. Acompañado de yuquitas fritas."],
  "Chicharrón de langostinos": ["🦐 Langostinos|🍟 Yuca", "Crocantes langostinos acompañados de yuquitas fritas."],
  "Chicharrón de calamar": ["🦑 Calamar|🌽 Choclo", "Crocante calamar acompañado de choclo."],
  "Chicharrón de pescado con calamar": ["🐟 Pescado|🦑 Calamar|🍟 Yuca", "Pescado y calamar crocantes, acompañados de yuquitas fritas."],
  "Chicharrón de pescado con langostinos": ["🐟 Pescado|🦐 Langostinos|🍟 Yuca", "Pescado y langostinos crocantes, acompañados de yuquitas fritas."],

  // ── Causas ──
  "Causa de langostinos": ["🥔 Papa amarilla|🦐 Langostinos|🌶️ Ají amarillo", "Fina masa de papa amarilla sazonada con crema de ají amarillo y limón."],
  "Causa de pescado": ["🥔 Papa amarilla|🐟 Pescado|🌶️ Ají amarillo", "Fina masa de papa amarilla sazonada con crema de ají amarillo y limón."],
  "Causa de pulpo al olivo": ["🥔 Papa amarilla|🐙 Pulpo|🫒 Olivo", "Bañada en salsa de olivo y mayonesa."],
  "Causa de pulpa de cangrejo": ["🥔 Papa amarilla|🦀 Cangrejo|🥚 Mayonesa", "Con el punto perfecto de mayonesa de la casa."],
  "Causa escabechada": ["🥔 Papa amarilla|🐟 Pescado|🧅 Escabeche", "Fina masa de papa amarilla rellena de pescado, láminas de palta y coronada con nuestro famoso escabeche de la abuela."],
  "Causa acevichada": ["🥔 Papa amarilla|🥑 Palta|🐟 Ceviche|🦑 Calamar", "Masa de causa rellena de láminas de palta, salsa acevichada y montada con ceviche de pescado con chicharrón de calamar."],

  // ── Pescados ──
  "Pescado Punto Azul": ["🐟 Pescado|🍖 Jamón|🧀 Queso", "Relleno con jamón y queso. Elige 2 guarniciones: arroz, puré o ensalada."],
  "Pescado apanado": ["🐟 Pescado|🍞 Apanado", "Filete apanado. Elige 2 guarniciones: arroz, puré o ensalada."],
  "Pescado a la plancha": ["🐟 Pescado|🔥 A la plancha", "Filete a la plancha. Elige 2 guarniciones: arroz, puré o ensalada."],
  "Pescado a lo macho": ["🐟 Pescado|🦑 Mariscos|🌶️ Salsa a lo macho", "Filetes de pescado frito bañados con cremosa salsa de mariscos a lo macho."],

  // ── Pastas ──
  "Spaghetti al pesto genovés": ["🍝 Spaghetti|🌿 Albahaca|🧀 Parmesano|🦐 Langostinos", "Tradicional salsa de albahaca, queso parmesano, aceite de oliva y nueces, servido con langostinos."],
  "Spaghetti a lo Alfredo": ["🍝 Spaghetti|🍖 Jamón|🧀 Parmesano", "Spaghetti en cremosa salsa de la casa, trocitos de jamón y toques de parmesano."],
  "Fettuccini a la huancaína": ["🍝 Fettuccini|🌶️ Ají amarillo|🦐 Langostinos", "Fettuccini en exquisita salsa huancaína, a base de ajíes y quesos andinos, con crocantes langostinos al panko."],
  "Fettuccini a la huancaína con lomo saltado": ["🍝 Fettuccini|🌶️ Huancaína|🥩 Lomo", "Jugosos dados de lomo al wok coronan nuestra exquisita pasta huancaína."],
  "Spaghetti al pesto acriollado con pescado apanado": ["🍝 Spaghetti|🌿 Albahaca|🐟 Pescado apanado|🥛 Leche", "Salsa de albahaca cocida, queso parmesano, aceite de oliva, nueces y un toque de leche."],

  // ── Arroces y Tacu Tacus ──
  "Arroz con mariscos": ["🍚 Arroz|🦑 Mariscos|🍅 Tomate", "Arroz atomatado con secretos del fundador. Un sabor inigualable."],
  "Arroz con langostinos": ["🍚 Arroz|🦐 Langostinos", "Atamalado arroz envuelto con langostinos al dente y el secreto marino del fundador."],
  "Arroz Punto Azul": ["🍚 Arroz|🌿 Culantro|🦑 Calamar|🦐 Langostino", "Arroz al culantro con salsa cremosa de calamar, langostino y pulpo."],
  "Chaufa de pescado": ["🍚 Arroz chaufa|🐟 Pescado|🍳 Capón", "Al wok con el secreto capón."],
  "Chaufa de mariscos": ["🍚 Arroz chaufa|🦑 Mariscos|🍳 Capón", "Al wok con el secreto capón, esta vez con mariscos."],
  "Risotto a la parmesana con langostinos": ["🍚 Arborio|🌶️ Ají amarillo|🦐 Langostinos|🧀 Parmesano", "Cremoso arborio al ají amarillo con langostinos flambeados al vino blanco."],
  "Risotto a la parmesana con pescado": ["🍚 Arborio|🌶️ Ají amarillo|🐟 Pescado|🧀 Parmesano", "Cremoso arborio al ají amarillo con crocantes pescaditos al panko."],
  "Tacu tacu especial": ["🫘 Frejoles|🍚 Arroz|🐟 Pescado apanado", "Cremosa y deliciosa mezcla de arroz y frejoles más pescado apanado."],
  "Tacu tacu con salsa a lo macho": ["🫘 Frejoles|🍚 Arroz|🦑 Mariscos|🌶️ A lo macho", "Tradicional mezcla de arroz y frejoles bañados con cremosa salsa de mariscos a lo macho."],
  "Tacu tacu con lomo saltado": ["🫘 Frejoles|🍚 Arroz|🥩 Lomo", "Jugosos dados de lomo al wok coronan nuestro famoso tacu tacu tradicional."],
  "Aeropuerto montado": ["🍚 Arroz frito|🫘 Frejol|🍜 Tallarín|🥚 Tortilla", "Arroz frito al wok con frejol y tallarín chino, montado con tortilla jugosa, chicharrón de pescado, sarza criolla y palta."],

  // ── Sopas ──
  "Sudado": ["🐟 Pescado|🍅 Tomate|🧅 Cebolla", "Pescado cocido en caldo atomatado."],
  "Chupe de pescado": ["🐟 Pescado|🎃 Zapallo|🫛 Habas|🧀 Queso fresco", "Filetes de pescado en caldo especial con zapallo, habas y queso fresco. ¡Una tradición costeña!"],
  "Chupe de langostinos": ["🦐 Langostinos|🎃 Zapallo|🫛 Habas|🧀 Queso fresco", "Jugosos langostinos en caldo especial con zapallo, habas y queso fresco. ¡Una tradición costeña!"],
  "Parihuela": ["🐟 Pescado|🦑 Mariscos|🦪 Choros", "Pescado y mariscos cocidos en caldo concentrado de choros."],

  // ── Vegetarianos ──
  "Chaufa de champiñones": ["🍄 Champiñones|🍚 Arroz|🍳 Capón", "Champiñones salteados al wok que envuelven nuestra receta Capón."],
  "Arroz con champiñones": ["🍄 Champiñones|🍚 Arroz", "Champiñones salteados y jugosos acompañan nuestro tradicional arroz atamalado."],
  "Risotto de champiñones": ["🍄 Champiñones|🍚 Arborio|🧀 Parmesano|🌿 Espárragos", "Arroz arborio de grano corto, crema de leche, champiñones salteados, queso parmesano y espárragos."],

  // ── El Especial ──
  "Lomo saltado": ["🥩 Lomo|🧅 Cebolla|🍅 Tomate|🍟 Papas", "Jugosos dados de lomo salteados al wok, acompañados de crocantes papitas amarillas y arroz blanco."],
  "Milanesa de pollo a la napolitana": ["🍗 Pollo|🍅 Tomate|🧀 Queso|🍖 Jamón", "Milanesa napolitana con salsa de tomate, queso y jamón. Acompañada con pasta corta a lo alfredo o pesto."],

  // ── Extras ──
  "Camote glaseado": ["🍠 Camote", "Porción de camote glaseado."],
  "Choclo": ["🌽 Choclo", "Porción de choclo."],
  "Puré": ["🥔 Papa", "Porción de puré."],
  "Arroz": ["🍚 Arroz", "Porción de arroz."],
  "Yuca": ["🍟 Yuca", "Porción de yuca."],
  "Ensalada": ["🥗 Ensalada", "Porción de ensalada fresca."],
  "Pan al ajo": ["🍞 Pan|🧄 Ajo", "Porción de pan al ajo de la casa."],
};

const findItem = db.prepare(
  "SELECT id FROM menu_items WHERE restaurant_id = ? AND name = ?"
);
const updateItem = db.prepare(
  "UPDATE menu_items SET ingredients = ?, detail = ? WHERE id = ?"
);

let enriched = 0;
const missing = [];
for (const [name, [ingredients, detail]] of Object.entries(ENRICH)) {
  const it = findItem.get(rid, name);
  if (!it) {
    missing.push(name);
    continue;
  }
  updateItem.run(ingredients, detail, it.id);
  enriched++;
}

// ── Secciones de barra del PDF que faltaban (Piscos y Cócteles, Mocktails) ──
const BAR = [
  [
    "Piscos y Cócteles",
    [
      ["Pisco Sour", "El clásico de la casa: pisco, jugo de limón, jarabe de goma y clara de huevo", 2600, "🍸", "🥃 Pisco|🍋 Limón|🥚 Clara de huevo"],
      ["Chilcano Clásico", "Pisco, jugo de limón, amargo de angostura y ginger ale", 2400, "🥂", "🥃 Pisco|🍋 Limón|🫧 Ginger ale"],
      ["Chilcano Rosa", "Pisco y Pink Soda (toronja)", 2700, "🥂", "🥃 Pisco|🍊 Toronja"],
      ["Peruanísimo", "Pisco, jugo de naranja, chicha morada, jugo de limón y crema de coco", 2700, "🍹", "🥃 Pisco|🍊 Naranja|🍇 Chicha morada|🥥 Coco"],
      ["Pisco Punch", "Pisco, jugo de piña, jugo de limón y jarabe de goma", 2700, "🍹", "🥃 Pisco|🍍 Piña|🍋 Limón"],
      ["Pisco Mule", "Pisco y ginger beer", 2800, "🍺", "🥃 Pisco|🫧 Ginger beer"],
      ["Mojito", "Ron, hierba buena, azúcar, limón y agua con gas", 2400, "🍸", "🥃 Ron|🌿 Hierba buena|🍋 Limón"],
      ["Piña Colada", "Ron, crema de coco y jugo de piña", 2600, "🍹", "🥃 Ron|🥥 Crema de coco|🍍 Piña"],
      ["Gin Tonic", "Gin Tanqueray Ten o La República y agua tónica", 3000, "🍸", "🥃 Gin|🫧 Agua tónica"],
      ["Margarita Azul", "Tequila, curaçao azul y limón", 2400, "🍸", "🥃 Tequila|🔵 Curaçao azul|🍋 Limón"],
      ["Negroni", "Gin, campari y vermouth tinto", 2700, "🥃", "🥃 Gin|🔴 Campari|🍷 Vermouth"],
      ["Laguna Azul", "Vodka, curaçao azul, jarabe de goma, jugo de limón y agua con gas", 2400, "🍹", "🥃 Vodka|🔵 Curaçao azul|🍋 Limón"],
    ],
  ],
  [
    "Mocktails",
    [
      ["Romero Apasionado", "Maracuyá, jarabe de romero y soda", 1900, "🍹", "🟡 Maracuyá|🌿 Romero|🫧 Soda"],
      ["El Manto de Luisa", "Aguaymanto, jarabe de hierba luisa, limón y soda", 1900, "🍹", "🟠 Aguaymanto|🌿 Hierba luisa|🍋 Limón"],
      ["Basil 321", "Piña golden, albahaca, jarabe de hierba luisa, naranja, limón y soda", 1900, "🍹", "🍍 Piña|🌿 Albahaca|🍊 Naranja"],
      ["Good Ginger", "Fresa, jarabe de kión, hierba buena, limón y soda", 1900, "🍹", "🍓 Fresa|🫚 Kión|🌿 Hierba buena"],
    ],
  ],
];

const maxSort = db
  .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE restaurant_id = ?")
  .get(rid).m;

const findCat = db.prepare(
  "SELECT id FROM categories WHERE restaurant_id = ? AND name = ?"
);
const insertCat = db.prepare(
  "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)"
);
const insertItem = db.prepare(
  `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, detail, ingredients, price_cents, emoji)
   VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)`
);

let added = 0;
let sort = maxSort;
for (const [catName, items] of BAR) {
  const cat = findCat.get(rid, catName);
  let cid;
  if (cat) {
    cid = cat.id;
  } else {
    cid = randomUUID();
    insertCat.run(cid, rid, catName, ++sort);
  }
  for (const [name, description, price, emoji, ingredients] of items) {
    if (findItem.get(rid, name)) continue; // no duplicar en re-ejecución
    insertItem.run(randomUUID(), rid, cid, name, description, ingredients, price, emoji);
    added++;
  }
}

console.log(`✔ ${enriched} platos enriquecidos con ingredientes y detalle`);
if (missing.length) console.warn(`⚠ no encontrados: ${missing.join(", ")}`);
console.log(`✔ ${added} ítems de barra agregados (Piscos y Cócteles, Mocktails)`);
db.close();
