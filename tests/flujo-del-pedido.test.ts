import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ErrorDePedido,
  cambiarEstado,
  cambiarMetodoPago,
  crearPedido,
  deshacerCobro,
  informarPago,
  listarPedidos,
  registrarCobro,
  verPedido,
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

  it("la caja puede deshacer un cobro puesto por error", () => {
    const { db, l, pedir } = local();
    const { id } = pedir();

    registrarCobro(db, id, "yape");
    const revertido = deshacerCobro(db, id);
    assert.equal(revertido?.payment_status, "unpaid", "vuelve a cuenta abierta");

    // Y vuelve a aparecer en la caja como pendiente, no en cobrados.
    const caja = listarPedidos(db, l.restaurant, "caja").orders;
    assert.equal(caja[0].payment_status, "unpaid");

    // Deshacer sobre algo que no está pagado no hace nada raro.
    const otra = deshacerCobro(db, id);
    assert.equal(otra?.payment_status, "unpaid");
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

  it("el cliente adjunta la captura y queda guardada para la caja", () => {
    const { db, pedir } = local();
    const { id } = pedir();

    const captura = "data:image/jpeg;base64,/9j/abc123";
    informarPago(db, id, captura);
    assert.equal(verPedido(db, id)!.order.payment_proof, captura, "se guarda la captura");
    assert.equal(verPedido(db, id)!.order.payment_status, "claimed");

    // Basura que no es una imagen no entra (defensa contra un payload cualquiera).
    const { id: id2 } = pedir();
    informarPago(db, id2, "javascript:alert(1)");
    assert.equal(verPedido(db, id2)!.order.payment_proof, "", "solo data:image/");
  });

  it("la caja anota número de operación, monto y propina al confirmar", () => {
    const { db, pedir } = local();
    const { id } = pedir(); // total 3500

    registrarCobro(db, id, "yape", { ref: "15857647", amountCents: 3500, tipCents: 500 });
    const o = verPedido(db, id)!.order;
    assert.equal(o.payment_ref, "15857647");
    assert.equal(o.paid_amount_cents, 3500);
    assert.equal(o.tip_cents, 500);

    // Sin monto explícito, se toma el total del pedido: el caso normal.
    const { id: id2 } = pedir();
    registrarCobro(db, id2, "cash");
    assert.equal(verPedido(db, id2)!.order.paid_amount_cents, 3500, "monto = total por defecto");
  });

  it("cambiar solo el método no borra la operación ni la propina ya anotadas", () => {
    const { db, pedir } = local();
    const { id } = pedir();

    registrarCobro(db, id, "card", { ref: "POS-9931", tipCents: 300 });
    cambiarMetodoPago(db, id, "yape");

    const o = verPedido(db, id)!.order;
    assert.equal(o.payment_method, "yape", "el método cambió");
    assert.equal(o.payment_ref, "POS-9931", "la operación se mantiene");
    assert.equal(o.tip_cents, 300, "la propina se mantiene");
    assert.equal(o.payment_status, "paid");
  });

  it("deshacer un cobro limpia lo que anotó la caja, pero conserva la captura del cliente", () => {
    const { db, pedir } = local();
    const { id } = pedir();

    informarPago(db, id, "data:image/png;base64,zzz");
    registrarCobro(db, id, "yape", { ref: "111", tipCents: 200 });
    deshacerCobro(db, id);

    const o = verPedido(db, id)!.order;
    assert.equal(o.payment_status, "unpaid");
    assert.equal(o.payment_ref, "", "se borra la operación de un cobro errado");
    assert.equal(o.tip_cents, 0, "se borra la propina");
    assert.equal(o.payment_proof, "data:image/png;base64,zzz", "la captura del cliente queda");
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
