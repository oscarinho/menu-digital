import { randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import type { Restaurant, StaffRole } from "@/lib/types";

export const STAFF_COOKIE = "vx_staff";
export const PLATFORM_COOKIE = "vx_platform";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días
const PLATFORM_ROLE = "platform";

const PROD = process.env.NODE_ENV === "production";

// Clave del dueño de la plataforma. Obligatoria en producción, y la demo NO es la
// excepción: es precisamente la que está en internet, y esta clave de conveniencia
// vive escrita en el repositorio. Si falta la variable, /plataforma no abre.
// Preferimos que la ruta falle a que quede abierta con una clave que cualquiera
// puede leer en GitHub.
export function platformKey(): string {
  const key = process.env.VECTARYX_PLATFORM_KEY;
  if (key) return key;
  if (PROD) {
    throw new Error(
      "Falta VECTARYX_PLATFORM_KEY: el panel /plataforma no arranca sin una clave propia."
    );
  }
  return "vectaryx2026";
}

// Comparación en tiempo constante: no filtra el secreto por cuánto tarda en fallar.
export function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // Detrás de Caddy todo es HTTPS, pero si alguien llega por HTTP antes del
    // redirect, sin esto la cookie de sesión viajaría en claro.
    secure: PROD,
  };
}

// Las sesiones caducadas se acumulaban para siempre (el SELECT las filtra, pero
// las filas quedaban). Se limpian al hacer login, que es cuando crece la tabla.
function purgeExpiredSessions() {
  getDb()
    .prepare("DELETE FROM sessions WHERE created_at <= datetime('now', '-30 days')")
    .run();
}

export async function createStaffSession(
  restaurantId: string,
  role: StaffRole
): Promise<void> {
  const db = getDb();
  purgeExpiredSessions();
  const token = randomUUID();
  db.prepare(
    "INSERT INTO sessions (token, restaurant_id, role) VALUES (?, ?, ?)"
  ).run(token, restaurantId, role);
  const store = await cookies();
  store.set(STAFF_COOKIE, token, cookieOptions());
}

export async function destroyStaffSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  store.delete(STAFF_COOKIE);
}

export interface StaffSession {
  restaurant: Restaurant;
  role: StaffRole;
}

// Sesión de personal actual, o null.
export async function staffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT restaurant_id, role FROM sessions
       WHERE token = ? AND restaurant_id IS NOT NULL
         AND created_at > datetime('now', '-30 days')`
    )
    .get(token) as { restaurant_id: string; role: StaffRole } | undefined;
  if (!row) return null;
  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(row.restaurant_id) as Restaurant | undefined;
  if (!restaurant) return null;
  return { restaurant, role: row.role === "admin" ? "admin" : "staff" };
}

/**
 * Autoriza una operación sobre un restaurante concreto.
 *
 * - Multitenant: la sesión de un restaurante nunca toca datos de otro.
 * - Rol: el PIN de cocina/caja (`staff`) no abre la administración. Cambiar
 *   precios o el número de Yape es redirigir el dinero del local, así que eso
 *   exige el PIN del dueño (`admin`).
 */
export async function requireStaff(
  restaurantId: string,
  role: StaffRole = "staff"
): Promise<Restaurant | null> {
  const session = await staffSession();
  if (!session || session.restaurant.id !== restaurantId) return null;
  if (role === "admin" && session.role !== "admin") return null;
  return session.restaurant;
}

// --- Panel de plataforma ----------------------------------------------------
// La cookie guarda un token de sesión aleatorio, no la clave. Si se filtra (un
// log, soporte remoto), se revoca borrando la fila; antes, filtrar la cookie era
// filtrar la clave maestra y solo quedaba rotarla en todas partes.

export async function createPlatformSession(): Promise<void> {
  const db = getDb();
  purgeExpiredSessions();
  const token = randomUUID();
  db.prepare(
    "INSERT INTO sessions (token, restaurant_id, role) VALUES (?, NULL, ?)"
  ).run(token, PLATFORM_ROLE);
  const store = await cookies();
  store.set(PLATFORM_COOKIE, token, cookieOptions());
}

export async function isPlatformAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (!token) return false;
  const row = getDb()
    .prepare(
      `SELECT token FROM sessions
       WHERE token = ? AND restaurant_id IS NULL AND role = ?
         AND created_at > datetime('now', '-30 days')`
    )
    .get(token, PLATFORM_ROLE);
  return !!row;
}

export async function destroyPlatformSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  store.delete(PLATFORM_COOKIE);
}
