// Exporta un CSV (filename, subject, format, prompt) con una fila por plato
// del tenant punto-azul, para generar fotos en lote (ChatGPT / API de imágenes).
// Usa una plantilla de estilo fija; solo cambia el sujeto por plato.
// Excluye los platos que ya tienen foto real y las bebidas embotelladas de marca.
// Uso: node scripts/export-punto-azul-csv.mjs

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const SLUG = "punto-azul";
// Los CSV son material de trabajo, no del producto: viven en ops/, fuera de la raíz.
const OUT_DIR = path.join(process.cwd(), "ops", "prompts-imagenes");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "punto-azul-imagenes.csv");

const db = new Database(path.join(process.cwd(), "data", "menu.db"));
const r = db.prepare("SELECT id FROM restaurants WHERE slug = ?").get(SLUG);
if (!r) {
  console.error("No existe el restaurante. Corre primero scripts/seed-punto-azul.mjs");
  process.exit(1);
}

const rows = db
  .prepare(
    `SELECT m.name, m.description, m.detail, m.ingredients, m.image, c.name AS category
       FROM menu_items m
       JOIN categories c ON c.id = m.category_id
      WHERE m.restaurant_id = ?
      ORDER BY c.sort_order, m.name`
  )
  .all(r.id);

// Bebidas embotelladas / de marca: no necesitan foto generada.
const SKIP = /coca cola|inca kola|agua san|cusque|pilsen|zatara/i;

// Plantilla de estilo fija (solo cambia SUJETO por fila).
const STYLE = [
  "Fotografía gastronómica profesional y muy apetitosa de un plato de cevichería peruana.",
  "Un solo plato servido en vajilla elegante, centrado, tomado en ángulo de 45 grados,",
  "luz natural suave, fondo neutro de madera clara o cerámica texturizada, colores vibrantes y frescos,",
  "alta definición, enfoque nítido con fondo desenfocado.",
  "Sin texto, sin personas, sin manos, sin logotipos ni marcas de agua.",
  "Imagen cuadrada 1024x1024.",
].join(" ");

const seenSlugs = new Set();
function slug(s) {
  const base = s
    .replace(/½/g, " media ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Guard anti-colisión: si dos platos generan el mismo slug, desambigua.
  let unique = base;
  let i = 2;
  while (seenSlugs.has(unique)) unique = `${base}-${i++}`;
  seenSlugs.add(unique);
  return unique;
}

// Quita el emoji inicial de cada chip "🥔 Papa amarilla" → "Papa amarilla".
function ingredientList(raw) {
  if (!raw) return "";
  return raw
    .split("|")
    .map((chip) => chip.trim().split(" ").slice(1).join(" "))
    .filter(Boolean)
    .join(", ");
}

function csvField(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

const HEADER = ["filename", "subject", "format", "prompt"].join(",");
const CHUNK = 10; // platos por ronda (ChatGPT permite máx. 10 imágenes por pedido)

const dataRows = [];
for (const row of rows) {
  if (row.image) continue; // ya tiene foto real
  if (SKIP.test(row.name)) continue;

  const desc = row.detail || row.description;
  const ings = ingredientList(row.ingredients);
  const subject =
    `${row.name} (${row.category}): ${desc}` +
    (ings ? ` Ingredientes: ${ings}.` : "");
  const prompt = `SUJETO: ${subject} ESTILO: ${STYLE}`;
  const filename = `punto-azul_${slug(row.name)}.png`;

  dataRows.push(
    [csvField(filename), csvField(subject), csvField("1:1"), csvField(prompt)].join(",")
  );
}

// CSV completo (referencia).
fs.writeFileSync(OUT, [HEADER, ...dataRows].join("\n") + "\n", "utf8");

// CSV por ronda de CHUNK platos, cada uno con su encabezado.
const rondas = Math.ceil(dataRows.length / CHUNK);
for (let i = 0; i < rondas; i++) {
  const slice = dataRows.slice(i * CHUNK, (i + 1) * CHUNK);
  const file = path.join(OUT_DIR, `punto-azul-imagenes-ronda-${i + 1}.csv`);
  fs.writeFileSync(file, [HEADER, ...slice].join("\n") + "\n", "utf8");
  console.log(`  ronda ${i + 1}: ${slice.length} platos → ${path.basename(file)}`);
}

console.log(`✔ ${dataRows.length} platos en ${rondas} rondas (CSV completo: ${path.basename(OUT)})`);
db.close();
