import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type {
  Category,
  MenuItem,
  PublicRestaurant,
  Restaurant,
  ServiceMode,
  Table,
} from "@/lib/types";

function toPublic(r: Restaurant): PublicRestaurant {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    currency: r.currency,
    country: r.country,
    phone: r.phone,
    address: r.address,
    yape_number: r.yape_number,
    plin_number: r.plin_number,
    payment_qr: r.payment_qr,
    logo: r.logo,
    cover_image: r.cover_image,
    brand_color: r.brand_color,
    service_mode: r.service_mode,
    active: r.active,
  };
}

const MODOS_VALIDOS: ServiceMode[] = ["despacho", "salon", "mixto"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const tables = db
    .prepare("SELECT * FROM tables WHERE restaurant_id = ? ORDER BY CAST(code AS INTEGER)")
    .all(restaurant.id) as Table[];
  const categories = db
    .prepare("SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order")
    .all(restaurant.id) as Category[];
  const items = db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY name")
    .all(restaurant.id) as MenuItem[];

  return NextResponse.json({
    restaurant: toPublic(restaurant),
    tables,
    categories,
    items,
  });
}

// Ajustes del restaurante (nombre, contacto, datos de cobro, PINes).
// Solo el dueño: cambiar el número de Yape es redirigir el dinero del local, así
// que el PIN de cocina/caja no basta.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDb();

  const restaurant = db
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }
  if (!(await requireStaff(restaurant.id, "admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    phone?: string;
    address?: string;
    yapeNumber?: string;
    plinNumber?: string;
    paymentQr?: string;
    logo?: string;
    coverImage?: string;
    brandColor?: string;
    serviceMode?: string;
    staffPin?: string;
    adminPin?: string;
  };

  const fields: [column: string, value: string][] = [];
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 80);
    if (!name) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    fields.push(["name", name]);
  }
  if (body.phone !== undefined) fields.push(["phone", String(body.phone).slice(0, 30)]);
  if (body.address !== undefined) fields.push(["address", String(body.address).slice(0, 120)]);
  if (body.yapeNumber !== undefined) fields.push(["yape_number", String(body.yapeNumber).slice(0, 30)]);
  if (body.plinNumber !== undefined) fields.push(["plin_number", String(body.plinNumber).slice(0, 30)]);
  if (body.paymentQr !== undefined) fields.push(["payment_qr", String(body.paymentQr).slice(0, 200)]);
  if (body.logo !== undefined) fields.push(["logo", String(body.logo).slice(0, 200)]);
  if (body.coverImage !== undefined) fields.push(["cover_image", String(body.coverImage).slice(0, 200)]);
  if (body.brandColor !== undefined) {
    const color = String(body.brandColor).trim();
    if (color !== "" && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "Color inválido (usa formato #rrggbb)" }, { status: 400 });
    }
    fields.push(["brand_color", color.toLowerCase()]);
  }
  if (body.serviceMode !== undefined) {
    if (!MODOS_VALIDOS.includes(body.serviceMode as ServiceMode)) {
      return NextResponse.json({ error: "Modo de servicio inválido" }, { status: 400 });
    }
    fields.push(["service_mode", body.serviceMode]);
  }
  if (body.staffPin !== undefined) {
    if (!/^\d{4,6}$/.test(String(body.staffPin))) {
      return NextResponse.json({ error: "El PIN debe tener 4 a 6 dígitos" }, { status: 400 });
    }
    fields.push(["staff_pin", String(body.staffPin)]);
  }
  if (body.adminPin !== undefined) {
    if (!/^\d{4,6}$/.test(String(body.adminPin))) {
      return NextResponse.json(
        { error: "El PIN de administrador debe tener 4 a 6 dígitos" },
        { status: 400 }
      );
    }
    fields.push(["admin_pin", String(body.adminPin)]);
  }

  for (const [column, value] of fields) {
    db.prepare(`UPDATE restaurants SET ${column} = ? WHERE id = ?`).run(
      value,
      restaurant.id
    );
  }

  const updated = db
    .prepare("SELECT * FROM restaurants WHERE id = ?")
    .get(restaurant.id) as Restaurant;
  return NextResponse.json({ restaurant: toPublic(updated) });
}
