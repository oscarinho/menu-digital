import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createStaffSession,
  destroyStaffSession,
  secretEquals,
  staffSession,
} from "@/lib/auth";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import type { Restaurant, StaffRole } from "@/lib/types";

// Un PIN son 4-6 dígitos: 10.000 combinaciones se prueban por script en minutos.
// Con esto, reventarlo pasa de minutos a meses, y quien escribe mal el suyo un
// par de veces ni se entera.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

// Login del personal: valida el PIN del restaurante y abre sesión con su rol.
export async function POST(req: Request) {
  const body = (await req.json()) as { slug?: string; pin?: string };
  const slug = String(body.slug ?? "");
  const pin = String(body.pin ?? "");

  const key = `login:${clientIp(req)}:${slug}`;
  const limit = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const restaurant = getDb()
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;

  // El PIN del dueño se comprueba primero: en los locales que aún no separaron
  // sus PINes ambos coinciden, y así la sesión sale con rol admin.
  let role: StaffRole | null = null;
  if (restaurant) {
    if (restaurant.admin_pin && secretEquals(pin, restaurant.admin_pin)) {
      role = "admin";
    } else if (secretEquals(pin, restaurant.staff_pin)) {
      role = "staff";
    }
  }
  if (!restaurant || !role) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  resetRateLimit(key);
  await createStaffSession(restaurant.id, role);
  return NextResponse.json({ ok: true, role });
}

// ¿La sesión actual sirve para este restaurante, y para este rol?
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const needsAdmin = searchParams.get("role") === "admin";

  const session = await staffSession();
  const authorized =
    !!session &&
    session.restaurant.slug === slug &&
    (!needsAdmin || session.role === "admin");

  return NextResponse.json({ authorized, role: session?.role ?? null });
}

export async function DELETE() {
  await destroyStaffSession();
  return NextResponse.json({ ok: true });
}
