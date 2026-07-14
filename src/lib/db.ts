import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const globalForDb = globalThis as unknown as { _menuDb?: Database.Database };

// Agrega una columna solo si no existe: permite reaplicar una migración sobre
// una base que ya la tenía (las creadas antes del versionado).
function addColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// ---------------------------------------------------------------------------
// Migraciones
//
// Cada entrada se aplica una sola vez, en orden y dentro de una transacción, y
// queda registrada en schema_migrations. Para cambiar el esquema se AÑADE una
// función al final del array; nunca se edita una ya aplicada, o las bases en
// producción quedarían en un estado distinto al de desarrollo.
// ---------------------------------------------------------------------------

const MIGRATIONS: ((db: Database.Database) => void)[] = [
  // 1 · Esquema base. Idempotente a propósito: las bases anteriores al
  // versionado ya tienen estas tablas, y así quedan en la versión 1 sin tocar
  // sus datos.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'PEN',
        country TEXT NOT NULL DEFAULT 'PE'
      );

      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        UNIQUE (restaurant_id, code)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
        category_id TEXT NOT NULL REFERENCES categories(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_cents INTEGER NOT NULL,
        emoji TEXT NOT NULL DEFAULT '🍽️',
        available INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
        table_id TEXT NOT NULL REFERENCES tables(id),
        daily_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL DEFAULT '',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        total_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
        name TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
        ON orders (restaurant_id, status);
    `);

    addColumn(db, "restaurants", "phone", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "address", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "yape_number", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "plin_number", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "payment_qr", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "logo", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "cover_image", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "brand_color", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "restaurants", "active", "INTEGER NOT NULL DEFAULT 1");
    addColumn(db, "restaurants", "plan", "TEXT NOT NULL DEFAULT 'piloto'");
    addColumn(db, "restaurants", "monthly_fee_cents", "INTEGER NOT NULL DEFAULT 9900");
    addColumn(db, "restaurants", "staff_pin", "TEXT NOT NULL DEFAULT '1234'");
    addColumn(db, "restaurants", "created_at", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "menu_items", "image", "TEXT NOT NULL DEFAULT ''");
    // Descripción ampliada e ingredientes (chips "emoji etiqueta" separados por
    // '|') que el cliente ve al expandir la tarjeta del plato.
    addColumn(db, "menu_items", "detail", "TEXT NOT NULL DEFAULT ''");
    addColumn(db, "menu_items", "ingredients", "TEXT NOT NULL DEFAULT ''");
  },

  // 2 · Zona horaria del local y PIN de administrador separado del de personal.
  (db) => {
    addColumn(db, "restaurants", "timezone", "TEXT NOT NULL DEFAULT 'America/Lima'");
    addColumn(db, "restaurants", "admin_pin", "TEXT NOT NULL DEFAULT ''");
    // Los locales que ya existían no tienen PIN de admin: hereda el del personal
    // para no dejar al dueño fuera de su propio panel. Hasta que lo cambie desde
    // Admin → Seguridad, el rol admin no lo protege de su propio equipo.
    db.exec("UPDATE restaurants SET admin_pin = staff_pin WHERE admin_pin = ''");
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
        ON orders (restaurant_id, created_at);
    `);
  },

  // 3 · Rol en la sesión ('staff' = cocina/caja, 'admin' = todo) y sesión del
  // panel de plataforma (restaurant_id NULL). Como restaurant_id era NOT NULL y
  // SQLite no permite quitarlo con ALTER, se recrea la tabla.
  (db) => {
    db.exec(`
      CREATE TABLE sessions_v3 (
        token TEXT PRIMARY KEY,
        restaurant_id TEXT REFERENCES restaurants(id),
        role TEXT NOT NULL DEFAULT 'staff',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO sessions_v3 (token, restaurant_id, role, created_at)
        SELECT token, restaurant_id, 'admin', created_at FROM sessions;
      DROP TABLE sessions;
      ALTER TABLE sessions_v3 RENAME TO sessions;
    `);
  },

  // 4 · Cuándo se recogió la mesa. Que el pedido esté entregado y pagado no
  // significa que la mesa esté libre: esa gente sigue ahí, con el café. La app ve
  // pedidos, no sillas, y no hay ninguna señal de que el comensal se haya ido —ni
  // siquiera un pedido nuevo lo prueba: pueden ser los mismos pidiendo postre.
  //
  // Esa señal solo la tiene quien recoge la mesa, así que se la pedimos: un toque
  // en "Liberar mesa". No es un estado que haya que mantener al día (eso se pudre
  // en una semana), es una fecha: la mesa está recogida si su última cuenta se
  // cerró ANTES de este freed_at. Si al mozo se le olvida, el siguiente pedido y
  // el cierre del día la dejan sana igual.
  (db) => {
    addColumn(db, "tables", "freed_at", "TEXT NOT NULL DEFAULT ''");
  },
];

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const { v } = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations")
    .get() as { v: number };

  for (let i = v; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    db.transaction(() => {
      MIGRATIONS[i](db);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
    })();
  }
}

// ---------------------------------------------------------------------------
// Fecha de negocio
//
// created_at se guarda en UTC (datetime('now')), pero "hoy" para un restaurante
// es su día local: en Lima (UTC-5) el día UTC cambia a las 7 pm, en plena cena.
// Comparar contra date('now') reiniciaría el número de pedido a #1 a media cena
// y partiría las métricas del día. Por eso todo lo que diga "hoy" usa el rango
// UTC correspondiente al día local del local.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

// Desfase (ms) entre la hora local de tz y UTC en un instante dado.
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // en hour12:false, medianoche puede venir como 24
    get("minute"),
    get("second")
  );
  return asUtc - at.getTime();
}

function toSqlite(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Rango [start, end) en UTC del día local del restaurante, listo para comparar
 * contra `orders.created_at`:
 *
 *     WHERE created_at >= :start AND created_at < :end
 *
 * `at` permite calcular el rango de otro instante (tests, reportes).
 */
export function businessDayRange(
  timezone: string,
  at: Date = new Date()
): { start: string; end: string } {
  let tz = timezone || "America/Lima";
  let offset: number;
  try {
    offset = tzOffsetMs(at, tz);
  } catch {
    // Zona inválida en la BD: no tumbamos el servicio del local por eso.
    tz = "America/Lima";
    offset = tzOffsetMs(at, tz);
  }
  const localMidnight = Math.floor((at.getTime() + offset) / DAY_MS) * DAY_MS;
  // Se recalcula el desfase EN esa medianoche: con horario de verano el de ahora
  // puede no ser el de entonces. (Perú no lo tiene; esto deja listo el resto.)
  const startMs = localMidnight - tzOffsetMs(new Date(localMidnight - offset), tz);
  return { start: toSqlite(startMs), end: toSqlite(startMs + DAY_MS) };
}

// Solo para estrenar una base vacía. Si ya hay restaurantes cargados no siembra
// nada: si no, borrar el local de ejemplo lo resucitaba en cada arranque.
function seed(db: Database.Database) {
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM restaurants")
    .get() as { count: number };
  if (count > 0) return;

  const rid = randomUUID();
  db.prepare(
    `INSERT INTO restaurants
       (id, slug, name, currency, country, phone, address, yape_number, plin_number,
        active, plan, monthly_fee_cents, staff_pin, admin_pin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'piloto', 9900, '1234', '1234', datetime('now'))`
  ).run(
    rid,
    "demo",
    "La Cevichería del Puerto",
    "PEN",
    "PE",
    "999 888 777",
    "Av. del Mar 123, Lima",
    "999 888 777",
    "999 888 777"
  );

  const insertTable = db.prepare(
    "INSERT INTO tables (id, restaurant_id, code, label) VALUES (?, ?, ?, ?)"
  );
  for (let i = 1; i <= 8; i++) {
    insertTable.run(randomUUID(), rid, String(i), `Mesa ${i}`);
  }

  const insertCategory = db.prepare(
    "INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)"
  );
  const insertItem = db.prepare(
    `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price_cents, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const menu: [string, [string, string, number, string][]][] = [
    [
      "Ceviches y Tiraditos",
      [
        ["Ceviche Clásico", "Pescado del día, leche de tigre, camote y choclo", 3500, "🐟"],
        ["Ceviche Mixto", "Pescado, pulpo, calamar y langostinos", 4500, "🦑"],
        ["Tiradito al Ají Amarillo", "Láminas de pescado en crema de ají amarillo", 3800, "🍋"],
        ["Leche de Tigre", "Concentrado del puerto con cancha y pescado", 2500, "🥛"],
      ],
    ],
    [
      "Platos de Fondo",
      [
        ["Lomo Saltado", "Res salteada al wok, papas fritas y arroz", 4200, "🥩"],
        ["Ají de Gallina", "Cremoso de ají amarillo con pollo deshilachado", 3200, "🍛"],
        ["Arroz con Mariscos", "Arroz al ají panca con mariscos frescos", 4800, "🦐"],
        ["Chaufa de Pollo", "Arroz frito al estilo chifa", 2800, "🍚"],
      ],
    ],
    [
      "Bebidas",
      [
        ["Chicha Morada", "Vaso de chicha morada casera", 800, "🍇"],
        ["Limonada", "Limonada fresca clásica o frozen", 900, "🍋"],
        ["Inca Kola 500ml", "La bebida de sabor nacional", 700, "🥤"],
        ["Pisco Sour", "El clásico de la casa", 2200, "🍸"],
      ],
    ],
    [
      "Postres",
      [
        ["Suspiro a la Limeña", "Manjar blanco y merengue al oporto", 1400, "🍮"],
        ["Picarones", "Con miel de chancaca (6 unidades)", 1200, "🍩"],
        ["Mazamorra Morada", "Con arroz con leche (clásico combinado)", 1000, "🍨"],
      ],
    ],
  ];

  menu.forEach(([categoryName, items], i) => {
    const cid = randomUUID();
    insertCategory.run(cid, rid, categoryName, i);
    for (const [name, description, price, emoji] of items) {
      insertItem.run(randomUUID(), rid, cid, name, description, price, emoji);
    }
  });
}

export function getDb(): Database.Database {
  if (!globalForDb._menuDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "menu.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    seed(db);
    globalForDb._menuDb = db;
  }
  return globalForDb._menuDb;
}

export function uploadsDir(): string {
  const dir = path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
