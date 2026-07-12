// Conecta a la carta las fotos de platos generadas que quedaron sueltas en
// ops/arte-generado. El nombre del archivo (punto-azul_<slug-del-plato>.png) es
// lo que las empareja con el plato. Complementa a seed-punto-azul-images.mjs,
// que asigna las fotos descargadas de la web real del restaurante.
// Uso: node scripts/connect-art.mjs [--dry]
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import sharp from "sharp";

const ART_DIR = "ops/arte-generado";
const UPLOADS = "data/uploads";
const PREFIX = "punto-azul_";
const dry = process.argv.includes("--dry");

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// "(docena)" y "(½ docena)" caen en el mismo slug: hay que nombrar el plato entero.
const EXPLICIT = {
  "conchitas-a-la-parmesana-docena": "Conchitas a la parmesana (docena)",
  "conchitas-a-la-parmesana-media-docena": "Conchitas a la parmesana (½ docena)",
};

const db = new Database(path.join(process.cwd(), "data", "menu.db"));
const items = db.prepare("SELECT id, name, image FROM menu_items").all();
const byName = new Map(items.map((i) => [i.name, i]));
const bySlug = new Map(items.map((i) => [slugify(i.name), i]));
const setImage = db.prepare("UPDATE menu_items SET image = ? WHERE id = ?");

let connected = 0;
for (const file of readdirSync(ART_DIR).filter((f) => f.startsWith(PREFIX) && f.endsWith(".png"))) {
  const key = file.slice(PREFIX.length, -".png".length);
  const item = key in EXPLICIT ? byName.get(EXPLICIT[key]) : bySlug.get(key);
  if (!item) {
    console.log(`  ✗ ningún plato coincide con ${file}`);
    continue;
  }
  if (item.image) {
    console.log(`  · ${item.name} ya tenía foto, no la piso`);
    continue;
  }
  const name = `${randomUUID()}.webp`;
  if (!dry) {
    // Mismo tratamiento que /api/upload da a las fotos que sube el dueño.
    await sharp(path.join(ART_DIR, file))
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(UPLOADS, name));
    setImage.run(`/api/images/${name}`, item.id);
  }
  console.log(`  ✓ ${item.name} → ${name}`);
  connected++;
}

const total = db.prepare("SELECT COUNT(*) c FROM menu_items").get().c;
const withPhoto = db.prepare("SELECT COUNT(*) c FROM menu_items WHERE image != ''").get().c;
console.log(
  `\n${dry ? "[dry] " : ""}Conectadas ${connected}. La carta queda con ${withPhoto}/${total} platos con foto.`,
);
db.close();
