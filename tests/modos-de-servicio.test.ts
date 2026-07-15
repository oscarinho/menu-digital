import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crearPedido, listarPedidos, verPedido } from "@/domain/pedidos";
import { baseTemporal, sembrarLocal } from "./local";

// Modos de servicio (migración 5). Lo que no puede romperse: que el pedido de
// mostrador —sin mesa— no se caiga del sistema. Un JOIN normal contra `tables` lo
// haría desaparecer de la cocina y de la caja, que es justo el pedido que un menú
// o una juguería no puede perder.

describe("modos de servicio", () => {
  it("un local nace en modo salón y sus pedidos, de mesa", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "cevicheria" });

    assert.equal(l.restaurant.service_mode, "salon", "el valor por defecto no cambia a nadie");

    const { id } = crearPedido(db, l.restaurant, l.mesas[0], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });
    const pedido = verPedido(db, id)!.order;
    assert.equal(pedido.origin, "mesa");
    assert.equal(pedido.delivery, "mozo");
    assert.equal(pedido.table_code, "1");
  });

  it("un pedido de mostrador nace sin mesa, para recoger", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "juguerie" });

    const { id } = crearPedido(db, l.restaurant, null, {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });
    const pedido = verPedido(db, id)!.order;
    assert.equal(pedido.origin, "mostrador");
    assert.equal(pedido.delivery, "recojo");
    assert.equal(pedido.table_id, null, "no salió de ninguna mesa");
    assert.equal(pedido.table_code, null, "y no hay mesa que nombrar");
  });

  it("el pedido de mostrador SÍ llega a la cocina y a la caja", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "sanguche" });

    crearPedido(db, l.restaurant, null, {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });

    // La red que atrapa el bug del JOIN: sin LEFT JOIN, estas dos listas vendrían
    // vacías y nadie prepararía ni cobraría el pedido.
    const cocina = listarPedidos(db, l.restaurant, "kitchen").orders;
    assert.equal(cocina.length, 1, "la cocina lo ve");
    assert.equal(cocina[0].table_code, null);

    const caja = listarPedidos(db, l.restaurant, "caja").orders;
    assert.equal(caja.length, 1, "la caja lo ve");
  });

  it("mostrador y mesa conviven en el mismo local", () => {
    const db = baseTemporal();
    const l = sembrarLocal(db, { slug: "chifa" });

    crearPedido(db, l.restaurant, l.mesas[0], {
      items: [{ id: l.platos["Ceviche"].id, quantity: 1 }],
    });
    crearPedido(db, l.restaurant, null, {
      items: [{ id: l.platos["Ceviche"].id, quantity: 2 }],
    });

    const caja = listarPedidos(db, l.restaurant, "caja").orders;
    assert.equal(caja.length, 2, "los dos pedidos, con mesa y sin ella");
    const origenes = caja.map((o) => o.origin).sort();
    assert.deepEqual(origenes, ["mesa", "mostrador"]);
  });
});
