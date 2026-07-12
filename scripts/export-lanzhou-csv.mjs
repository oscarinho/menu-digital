// Exporta los prompts para fotografiar 20 platos de Lanzhou Noodles, en rondas de
// 10 (el máximo que acepta el generador por pedido). Mismo pipeline que Punto Azul:
//   node scripts/export-lanzhou-csv.mjs   → CSV en ops/prompts-imagenes/
//   (generas las imágenes y las dejas en ops/arte-generado/ con el nombre del CSV)
//   node scripts/connect-art.mjs          → las mete en la carta
//
// Los platos se llaman en chino, así que el nombre del archivo no se puede derivar
// del nombre del plato: cada uno lleva una clave latina fija y un manifiesto
// filename → plato, que es lo que luego lee connect-art.mjs.

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const SLUG = "lanzhou-noodles";
const CSV_DIR = path.join(process.cwd(), "ops", "prompts-imagenes");
const ART_DIR = path.join(process.cwd(), "ops", "arte-generado");
const CHUNK = 10;

// Los 20 que venden: el plato de la casa, lo más pedido de cada categoría y las
// tres verduras (una carta de puro marrón no abre el apetito en el celular).
const PICK = [
  ["牛肉拉面", "tallarin-lanzhou"],
  ["红烧牛肉面", "tallarin-carne-estofada"],
  ["酸菜牛肉面", "tallarin-col-encurtida"],
  ["牛肉刀削面", "tallarin-cortado-a-cuchillo"],
  ["番茄鸡蛋面", "tallarin-tomate-huevo"],
  ["土豆烧牛肉拌面", "mezclado-carne-papas"],
  ["大盘鸡拌面", "mezclado-pollo-gran-plato"],
  ["牛肉炒拉条（拉条子）", "mezclado-salteado-carne"],
  ["葱油拌面", "mezclado-salsa-cebolla"],
  ["酸菜牛肉炒饭", "chaufa-carne-col"],
  ["红烧牛肉盖饭", "arroz-carne-estofada"],
  ["大盘鸡盖饭", "arroz-pollo-gran-plato"],
  ["特色大盘鸡", "gran-plato-pollo"],
  ["凉拌牛肉", "ternera-fria"],
  ["红烧牛肉", "ternera-estofada"],
  ["孜然牛肉", "ternera-comino"],
  ["葱爆牛肉", "ternera-cebolla"],
  ["青椒土豆丝", "papa-pimiento-verde"],
  ["酸辣白菜", "col-agria-picante"],
  ["羊肉串", "brocheta-cordero"],
];

const STYLE = [
  "Fotografía gastronómica profesional y muy apetitosa de un plato de restaurante chino del noroeste (cocina de Lanzhou, fideos tirados a mano).",
  "Un solo plato servido en vajilla de restaurante sencilla —cuenco hondo de cerámica o plato blanco—, centrado, tomado en ángulo de 45 grados,",
  "luz natural suave, fondo neutro de mesa de madera oscura, vapor visible si el plato va caliente,",
  "colores intensos: el rojo del aceite de chile, el verde del cilantro y el cebollín.",
  "Alta definición, enfoque nítido con fondo desenfocado.",
  "Sin texto, sin personas, sin manos, sin logotipos ni marcas de agua.",
  "Imagen cuadrada 1024x1024.",
].join(" ");

const db = new Database(path.join(process.cwd(), "data", "menu.db"), { readonly: true });
const r = db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(SLUG);
if (!r) {
  console.error("No existe el restaurante. Corre primero: node scripts/seed-lanzhou.mjs");
  process.exit(1);
}

const byName = new Map(
  db
    .prepare(
      `SELECT m.name, m.description, m.image, c.name AS category
         FROM menu_items m JOIN categories c ON c.id = m.category_id
        WHERE m.restaurant_id = ?`,
    )
    .all(r.id)
    .map((m) => [m.name, m]),
);

const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;
const HEADER = ["filename", "subject", "format", "prompt"].join(",");

const rows = [];
const manifest = {};
for (const [name, key] of PICK) {
  const dish = byName.get(name);
  if (!dish) {
    console.warn(`  ⚠ no está en la carta, lo omito: ${name}`);
    continue;
  }
  if (dish.image) {
    console.log(`  · ya tiene foto, lo omito: ${name}`);
    continue;
  }
  const filename = `${SLUG}_${key}.png`;
  // El generador entiende el español; el nombre chino va como referencia del plato.
  const subject = `${dish.description} (${name}), de la sección "${dish.category}".`;
  rows.push(
    [
      csvField(filename),
      csvField(subject),
      csvField("1:1"),
      csvField(`SUJETO: ${subject} ESTILO: ${STYLE}`),
    ].join(","),
  );
  manifest[filename] = name;
}

fs.mkdirSync(CSV_DIR, { recursive: true });
fs.mkdirSync(ART_DIR, { recursive: true });

const rondas = Math.ceil(rows.length / CHUNK);
for (let i = 0; i < rondas; i++) {
  const slice = rows.slice(i * CHUNK, (i + 1) * CHUNK);
  const file = path.join(CSV_DIR, `lanzhou-imagenes-ronda-${i + 1}.csv`);
  fs.writeFileSync(file, [HEADER, ...slice].join("\n") + "\n", "utf8");
  console.log(`  ronda ${i + 1}: ${slice.length} platos → ${path.basename(file)}`);
}

// connect-art.mjs lee esto para saber a qué plato pertenece cada archivo.
const manifestPath = path.join(ART_DIR, `_manifest-${SLUG}.json`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log(`\n✔ ${rows.length} platos en ${rondas} rondas.`);
console.log(`  Manifiesto: ops/arte-generado/${path.basename(manifestPath)}`);
console.log(`  Deja los PNG en ops/arte-generado/ con el nombre exacto del CSV y corre:`);
console.log(`    node scripts/connect-art.mjs`);
db.close();
