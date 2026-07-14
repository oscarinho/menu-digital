import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ErrorDePedido,
  cambiarEstado,
  crearPedido,
  informarPago,
  listarPedidos,
  registrarCobro,
} from "@/domain/pedidos";
import { baseTemporal, sembrarLocal } from "./local";

// El día de un pedido, de punta a punta: nace en la mesa, la cocina lo mueve, el
// comensal dice que pagó, la caja lo confirma. Cada pantalla ve lo que le toca y
// solo lo que le toca.

function local() {
  const db = baseTemporal();
  const l = sembrarLocal(db, { slug: "cevicheria", carta: [{ nombre: "Ceviche", precio: 3500 }] });
  const pedir = () =>
    crearPedido(db, l.restaurant, l.mesas[0], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });
  return { db, l, pedir };
}

describe("el pedido, de la mesa a la caja", () => {
  it("nace pendiente y sin pagar", () => {
    const { db, l, pedir } = local();
    pedir();

    const [pedido] = listarPedidos(db, l.restaurant, "kitchen").orders;
    assert.equal(pedido.status, "pending");
    assert.equal(pedido.payment_status, "unpaid");
    assert.equal(pedido.table_code, "1", "la comanda dice de qué mesa viene");
  });

  it("la cocina lo mueve, y el entregado no desaparece de la pantalla", () => {
    const { db, l, pedir } = local();
    const { id } = pedir();

    for (const estado of ["preparing", "ready", "delivered"] as const) {
      cambiarEstado(db, id, estado);
    }

    // El entregado sigue en cocina ("¿la mesa 4 ya tiene su plato?"), pero fuera de
    // las columnas de trabajo: baja a "Entregados hoy".
    const cocina = listarPedidos(db, l.restaurant, "kitchen").orders;
    assert.equal(cocina.length, 1);
    assert.equal(cocina[0].status, "delivered");
  });

  it("un estado inventado no entra", () => {
    const { db, pedir } = local();
    const { id } = pedir();

    assert.throws(
      // @ts-expect-error — a propósito: esto es lo que mandaría un cliente hostil.
      () => cambiarEstado(db, id, "regalado"),
      (e: unknown) => e instanceof ErrorDePedido && e.status === 400
    );
  });

  it("'ya pagué' no cobra: solo avisa a la caja", () => {
    const { db, l, pedir } = local();
    const { id } = pedir();

    const tras = informarPago(db, id);
    assert.equal(tras?.payment_status, "claimed", "lo dice el cliente; no lo confirma nadie");

    // La caja lo ve resaltado, todavía por cobrar.
    const caja = listarPedidos(db, l.restaurant, "caja").orders;
    assert.equal(caja.length, 1);
    assert.equal(caja[0].payment_status, "claimed");
  });

  it("repetir 'ya pagué' no deshace un cobro ya confirmado", () => {
    const { db, pedir } = local();
    const { id } = pedir();

    informarPago(db, id);
    registrarCobro(db, id, "yape");

    // El cliente le da otra vez al botón. Un pedido cobrado no puede volver a "por
    // confirmar": eso descuadraría la caja al cierre.
    const tras = informarPago(db, id);
    assert.equal(tras?.payment_status, "paid");
  });

  it("la caja confirma el cobro y guarda con qué se pagó", () => {
    const { db, l, pedir } = local();
    const { id } = pedir();

    informarPago(db, id);
    const cobrado = registrarCobro(db, id, "yape");
    assert.equal(cobrado?.payment_status, "paid");
    assert.equal(cobrado?.payment_method, "yape");

    // Lo cobrado no se borra de la pantalla: es lo que la caja necesita para cuadrar.
    const caja = listarPedidos(db, l.restaurant, "caja").orders;
    assert.equal(caja.length, 1);
    assert.equal(caja[0].payment_status, "paid");
  });

  it("la mesa que ya comió y ya pagó queda como cuenta cerrada, no desaparece", () => {
    const { db, l } = local();

    const servido = crearPedido(db, l.restaurant, l.mesas[0], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });
    const porAdelantado = crearPedido(db, l.restaurant, l.mesas[1], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });

    cambiarEstado(db, servido.id, "delivered");
    registrarCobro(db, servido.id, "efectivo");
    registrarCobro(db, porAdelantado.id, "efectivo"); // pagó al pedir, aún no come

    const salon = listarPedidos(db, l.restaurant, "salon").orders;
    const ids = salon.map((o) => o.id);

    // El de la mesa 2 sigue ocupando su mesa: pagó, pero espera su plato.
    assert.ok(ids.includes(porAdelantado.id));
    // El de la mesa 1 ya comió y ya pagó. Sigue apareciendo —pagar no libera la mesa:
    // esa gente sigue sentada con el café— pero como cuenta cerrada.
    assert.ok(ids.includes(servido.id));
    const cerrado = salon.find((o) => o.id === servido.id)!;
    assert.equal(cerrado.status, "delivered");
    assert.equal(cerrado.payment_status, "paid");
  });

  it("el pedido cancelado desaparece de la caja y del salón", () => {
    const { db, l, pedir } = local();
    const { id } = pedir();

    cambiarEstado(db, id, "cancelled");

    assert.equal(listarPedidos(db, l.restaurant, "caja").orders.length, 0);
    assert.equal(listarPedidos(db, l.restaurant, "salon").orders.length, 0);
  });

  it("el salón trae también las mesas vacías, que no tienen ningún pedido", () => {
    const { db, l, pedir } = local();
    pedir();

    const salon = listarPedidos(db, l.restaurant, "salon");
    assert.equal(salon.orders.length, 1);
    assert.equal(salon.tables?.length, 3, "las 3 mesas, no solo la que pidió");
  });
});
