// El pedido en curso de una mesa, recordado en el celular del comensal.
//
// Al enviar el pedido lo llevamos a /pedido/<id>, pero esa URL no la conoce nadie
// más: si cierra la pestaña, o vuelve a escanear el QR de la mesa, se queda sin
// forma de volver a su pedido. Guardamos el id en el propio dispositivo —no en el
// servidor— para que la carta pueda ofrecerle volver a él.
//
// Va por dispositivo a propósito: si lo resolviéramos por mesa desde el servidor,
// cualquiera que abriese /r/<local>/mesa/1 desde su casa vería lo que están
// comiendo en esa mesa.

import type { Order } from "./types";

const key = (slug: string, table: string) => `vectaryx:pedido:${slug}:${table}`;

export function rememberOrder(slug: string, table: string, orderId: string): void {
  try {
    localStorage.setItem(key(slug, table), orderId);
  } catch {
    // Modo privado de Safari y similares: sin memoria, pero la carta sigue viva.
  }
}

export function recallOrder(slug: string, table: string): string | null {
  try {
    return localStorage.getItem(key(slug, table));
  } catch {
    return null;
  }
}

export function forgetOrder(slug: string, table: string): void {
  try {
    localStorage.removeItem(key(slug, table));
  } catch {
    // Si no se pudo borrar, tampoco pasa nada: el pedido terminado no se muestra.
  }
}

// Un pedido deja de estar "en curso" cuando ya no hay nada que el comensal deba
// mirar: se lo entregaron y está pagado, o se canceló.
export function isOrderOpen(order: Pick<Order, "status" | "payment_status">): boolean {
  if (order.status === "cancelled") return false;
  return !(order.status === "delivered" && order.payment_status === "paid");
}
