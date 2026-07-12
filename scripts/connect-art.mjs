// Conecta a la carta las fotos generadas que están sueltas en ops/arte-generado.
// El archivo se llama <slug-del-restaurante>_<clave-del-plato>.png, y así se sabe
// a qué local pertenece. Para saber a qué plato:
//   1. el manifiesto _manifest-<slug>.json, si lo hay (obligatorio cuando el plato
//      se llama en chino: de ahí no sale ningún slug latino);
//   2. si no, se empareja el nombre del plato normalizado con la clave del archivo.
// No pisa fotos que ya existen.
// Uso: node scripts/connect-art.mjs [--dry]
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import sharp from "sharp";

const ART_DIR = "ops/arte-generado";
const UPLOADS = "data/uploads";
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
  "punto-azul_conchitas-a-la-parmesana-docena": "Conchitas a la parmesana (docena)",
  "punto-azul_conchitas-a-la-parmesana-media-docena": "Conchitas a la parmesana (½ docena)",
};

const db = new Database(path.join(process.cwd(), "data", "menu.db"));
const setImage = db.prepare("UPDATE menu_items SET image = ? WHERE id = ?");

// Un índice por restaurante: sus platos por nombre exacto y por nombre normalizado.
const tenants = new Map();
for (const r of db.prepare("SELECT id, slug, name FROM restaurants").all()) {
  const items = db
    .prepare("SELECT id, name, image FROM menu_items WHERE restaurant_id = ?")
    .all(r.id);
  const manifestPath = path.join(ART_DIR, `_manifest-${r.slug}.json`);
  tenants.set(r.slug, {
    name: r.name,
    byName: new Map(items.map((i) => [i.name, i])),
    bySlug: new Map(items.map((i) => [slugify(i.name), i])),
    manifest: existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {},
  });
}

const files = readdirSync(ART_DIR).filter((f) => f.endsWith(".png"));
let connected = 0;

for (const file of files) {
  const sep = file.indexOf("_");
  const tenantSlug = sep === -1 ? "" : file.slice(0, sep);
  const tenant = tenants.get(tenantSlug);
  if (!tenant) {
    console.log(`  ✗ no sé de qué restaurante es: ${file}`);
    continue;
  }

  const base = file.slice(0, -".png".length);
  const dishName = tenant.manifest[file] ?? EXPLICIT[base];
  const item = dishName ? tenant.byName.get(dishName) : tenant.bySlug.get(base.slice(sep + 1));
  if (!item) {
    console.log(`  ✗ ningún plato de ${tenant.name} coincide con ${file}`);
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
  console.log(`  ✓ [${tenant.name}] ${item.name} → ${name}`);
  connected++;
}

console.log(`\n${dry ? "[dry] " : ""}Conectadas ${connected}.`);
for (const [slug, t] of tenants) {
  const total = db
    .prepare("SELECT COUNT(*) c FROM menu_items WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = ?)")
    .get(slug).c;
  const withPhoto = db
    .prepare(
      "SELECT COUNT(*) c FROM menu_items WHERE image != '' AND restaurant_id = (SELECT id FROM restaurants WHERE slug = ?)",
    )
    .get(slug).c;
  console.log(`  ${t.name}: ${withPhoto}/${total} platos con foto.`);
}
db.close();
