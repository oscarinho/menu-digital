import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import {
  ErrorDePedido,
  buscarPedido,
  cambiarEstado,
  cambiarMetodoPago,
  deshacerCobro,
  informarPago,
  registrarCobro,
  verPedido,
} from "@/domain/pedidos";
import type { OrderStatus } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = verPedido(getDb(), id);
  if (!found) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  const { order, restaurant } = found;

  return NextResponse.json({
    order,
    currency: restaurant.currency,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    branding: {
      logo: restaurant.logo,
      brandColor: restaurant.brand_color,
    },
    // Para que el cliente pueda pagar con Yape/Plin desde el tracking.
    payment: {
      yapeNumber: restaurant.yape_number,
      plinNumber: restaurant.plin_number,
      qr: restaurant.payment_qr,
    },
    // En la demo pública los números de Yape/Plin son ficticios: la pantalla de
    // pago lo advierte para que nadie transfiera dinero de verdad.
    demo: process.env.VECTARYX_DEMO === "1",
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: OrderStatus;
    paymentMethod?: string;
    claimPayment?: boolean;
    revertPayment?: boolean;
    // Solo cambiar el método de un cobro ya confirmado, sin tocar operación/monto/propina.
    changeMethod?: boolean;
    // Captura que sube el cliente al avisar el pago (data URI base64).
    proof?: string;
    // Lo que anota la caja al confirmar: N.º de operación, monto y propina.
    paymentRef?: string;
    amountCents?: number;
    tipCents?: number;
  };
  const db = getDb();

  const order = buscarPedido(db, id);
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Acción pública (cliente): "ya pagué con Yape/Plin" → queda por confirmar en
  // caja. Es lo único que puede hacer alguien sin PIN.
  if (body.claimPayment) {
    return NextResponse.json({ order: informarPago(db, id, body.proof) });
  }

  // Acciones de staff: cambiar estado (cocina) y confirmar cobro (caja).
  if (!(await requireStaff(order.restaurant_id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    if (body.status) cambiarEstado(db, id, body.status);
    // Deshacer un cobro puesto por error: vuelve a cuenta abierta. Va antes de
    // registrarCobro para que un mismo PATCH no revierta y cobre a la vez.
    if (body.revertPayment) deshacerCobro(db, id);
    else if (body.changeMethod && body.paymentMethod)
      cambiarMetodoPago(db, id, body.paymentMethod);
    else if (body.paymentMethod)
      registrarCobro(db, id, body.paymentMethod, {
        ref: body.paymentRef,
        amountCents: body.amountCents,
        tipCents: body.tipCents,
      });
  } catch (e) {
    if (e instanceof ErrorDePedido) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  return NextResponse.json({ order: buscarPedido(db, id) });
}
