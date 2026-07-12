// Asigna las fotos reales de puntoazulrestaurante.com al tenant punto-azul.
// Requiere las imágenes ya descargadas en /tmp/pa-img (ver sesión de carga)
// y el seed previo: node scripts/seed-punto-azul.mjs
// Uso: node scripts/seed-punto-azul-images.mjs

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const SRC = "/tmp/pa-img";
const SLUG = "punto-azul";

const db = new Database(path.join(process.cwd(), "data", "menu.db"));
db.pragma("foreign_keys = ON");

const uploads = path.join(process.cwd(), "data", "uploads");
fs.mkdirSync(uploads, { recursive: true });

// foto descargada → nombre exacto del plato en la BD
const PHOTO_TO_DISH = [
  ["puntoazul_rissocopa.jpeg", "Rissocopa"],
  ["leche-de-tigre-2.webp", "Leche de tigre"],
  ["ceviche-mix-2-1.webp", "Ceviche mixto"],
  ["jalea-mixta-2-1.webp", "Chicharrón mixto"],
  ["causa-escabechada-2-1.webp", "Causa escabechada"],
  ["pescado-a-lo-macho-2-1.webp", "Pescado a lo macho"],
  ["Spaguetti-al-pesto-con-pascado-apanado-2.webp", "Spaghetti al pesto acriollado con pescado apanado"],
  ["arroz-con-mariscos-2.webp", "Arroz con mariscos"],
  ["chupe-de-langostinos-2.webp", "Chupe de langostinos"],
  ["risoto-de-champinones-2.webp", "Risotto de champiñones"],
  ["lomo-saltado-2.webp", "Lomo saltado"],
  ["camote-glaseado-2.webp", "Camote glaseado"],
  ["crema-volteada-punto-azul-2.webp", "Crema volteada"],
  ["jarra-de-maracuya-2.webp", "Jarra de maracuyá"],
];

// El API de imágenes solo acepta uuid.(jpg|png|webp); jpeg se normaliza a jpg.
function importImage(file) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ no existe ${src}, omitido`);
    return null;
  }
  let ext = path.extname(file).slice(1).toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  const name = `${randomUUID()}.${ext}`;
  fs.copyFileSync(src, path.join(uploads, name));
  return `/api/images/${name}`;
}

const restaurant = db
  .prepare("SELECT id FROM restaurants WHERE slug = ?")
  .get(SLUG);
if (!restaurant) {
  console.error("Primero ejecuta: node scripts/seed-punto-azul.mjs");
  process.exit(1);
}
const rid = restaurant.id;

const updateItem = db.prepare(
  "UPDATE menu_items SET image = ? WHERE restaurant_id = ? AND name = ?"
);

let assigned = 0;
for (const [file, dish] of PHOTO_TO_DISH) {
  const url = importImage(file);
  if (!url) continue;
  const res = updateItem.run(url, rid, dish);
  if (res.changes === 0) console.warn(`⚠ plato no encontrado: ${dish}`);
  else assigned++;
}

const logoUrl = importImage("logo-final.png");
const coverUrl = importImage("puntoazul_metaimage-1.jpg");
db.prepare("UPDATE restaurants SET logo = ?, cover_image = ? WHERE id = ?").run(
  logoUrl ?? "",
  coverUrl ?? "",
  rid
);

console.log(`✔ ${assigned} fotos de platos asignadas, logo y portada configurados`);
db.close();
