import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cambiarEstado, crearPedido, listarDespacho, verPedido } from "@/domain/pedidos";
import { baseTemporal, sembrarLocal } from "./local";

// Lo nuevo de 1C: el nombre del cliente de mostrador, las huellas de tiempo del pedido
// (listo/entregado) y lo que canta la pantalla de despacho.

describe("despacho y tiempos del pedido (1C)", () => {
  it("el nombre del cliente se guarda solo en el pedido de mostrador", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "juguerie" });

    const mostrador = crearPedido(db, l.restaurant, null, {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
      customerName: "  Óscar  ",
    });
    assert.equal(verPedido(db, mostrador.id)!.order.customer_name, "Óscar", "recortado");

    // En un pedido de mesa el nombre se ignora: la mesa ya nombra el pedido.
    const mesa = crearPedido(db, l.restaurant, l.mesas[0], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
      customerName: "no debería quedar",
    });
    assert.equal(verPedido(db, mesa.id)!.order.customer_name, "");
  });

  it("la hora de listo se sella una vez y no se pisa al repetir", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "sanguche" });
    const { id } = crearPedido(db, l.restaurant, null, {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });

    assert.equal(verPedido(db, id)!.order.ready_at, "", "nace sin sellar");

    cambiarEstado(db, id, "preparing");
    assert.equal(verPedido(db, id)!.order.ready_at, "", "preparando tampoco lo sella");

    cambiarEstado(db, id, "ready");
    const primera = verPedido(db, id)!.order.ready_at;
    assert.notEqual(primera, "", "listo sí lo sella");

    // Volver a marcar listo (un toque repetido) no reinicia el reloj: los reportes de
    // tiempo de cocina mentirían si cada clic empezara a contar de nuevo.
    cambiarEstado(db, id, "ready");
    assert.equal(verPedido(db, id)!.order.ready_at, primera);

    cambiarEstado(db, id, "delivered");
    assert.notEqual(verPedido(db, id)!.order.delivered_at, "", "entregado se sella");
  });

  it("la pantalla de despacho solo canta lo que está en preparación o listo", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "menu" });
    const pedir = (nombre?: string) =>
      crearPedido(db, l.restaurant, null, {
        items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
        customerName: nombre,
      });

    const a = pedir("Ana"); // se queda pendiente → no sale
    const b = pedir("Beto"); // preparando
    const c = pedir("Cira"); // listo
    const d = pedir("Dan"); // entregado → ya no sale
    cambiarEstado(db, b.id, "preparing");
    cambiarEstado(db, c.id, "ready");
    cambiarEstado(db, d.id, "delivered");

    const tv = listarDespacho(db, l.restaurant);
    const numeros = tv.map((o) => o.daily_number).sort((x, y) => x - y);
    assert.deepEqual(
      numeros,
      [b.dailyNumber, c.dailyNumber].sort((x, y) => x - y)
    );
    // Trae el nombre, que es con lo que se llama al cliente.
    assert.ok(tv.some((o) => o.customer_name === "Cira"));
    // El pendiente y el entregado no están.
    assert.ok(!numeros.includes(a.dailyNumber));
    assert.ok(!numeros.includes(d.dailyNumber));
  });
});
