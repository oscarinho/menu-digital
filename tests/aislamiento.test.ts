import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseTemporal, sembrarLocal } from "./local";
import { ErrorDePedido, crearPedido, listarPedidos, verPedido } from "@/domain/pedidos";

// Lo que nunca puede pasar en un SaaS multitenant: que un local vea, cobre o
// cocine algo de otro. Es el único fallo del que no se vuelve — un restaurante que
// ve los pedidos del de al lado no te da una segunda oportunidad.
//
// Todo esto se verificó a mano en su día. Estos tests existen para que siga siendo
// verdad el día que nadie se acuerde de comprobarlo.

function dosLocales() {
  const db = baseTemporal();
  const azul = sembrarLocal(db, {
    slug: "punto-azul",
    carta: [{ nombre: "Ceviche", precio: 3500 }],
  });
  const lanzhou = sembrarLocal(db, {
    slug: "lanzhou-noodles",
    carta: [{ nombre: "牛肉拉面", precio: 2200 }],
  });
  return { db, azul, lanzhou };
}

describe("aislamiento entre locales", () => {
  it("la cocina de un local no ve los pedidos del otro", () => {
    const { db, azul, lanzhou } = dosLocales();

    crearPedido(db, azul.restaurant, azul.mesas[0], {
      items: [{ id: azul.platos["Ceviche"].id, quantity: 1 }],
    });
    crearPedido(db, lanzhou.restaurant, lanzhou.mesas[0], {
      items: [{ id: lanzhou.platos["牛肉拉面"].id, quantity: 2 }],
    });

    const cocinaAzul = listarPedidos(db, azul.restaurant, "kitchen");
    const cocinaLanzhou = listarPedidos(db, lanzhou.restaurant, "kitchen");

    assert.equal(cocinaAzul.orders.length, 1);
    assert.equal(cocinaLanzhou.orders.length, 1);
    assert.equal(cocinaAzul.orders[0].items[0].name, "Ceviche");
    assert.equal(cocinaLanzhou.orders[0].items[0].name, "牛肉拉面");
    assert.equal(cocinaAzul.orders[0].restaurant_id, azul.restaurant.id);
    assert.equal(cocinaLanzhou.orders[0].restaurant_id, lanzhou.restaurant.id);
  });

  it("no se puede pedir un plato de otro local, ni sabiendo su id", () => {
    const { db, azul, lanzhou } = dosLocales();

    // El ataque: mandarle a Punto Azul el id de un plato de Lanzhou. Si colara,
    // entraría en la cuenta del local equivocado, con el precio del otro.
    assert.throws(
      () =>
        crearPedido(db, azul.restaurant, azul.mesas[0], {
          items: [{ id: lanzhou.platos["牛肉拉面"].id, quantity: 1 }],
        }),
      (e: unknown) => e instanceof ErrorDePedido && e.status === 409
    );

    assert.equal(listarPedidos(db, azul.restaurant, "kitchen").orders.length, 0);
  });

  it("el salón de un local solo enseña sus propias mesas", () => {
    const { db, azul, lanzhou } = dosLocales();

    const salon = listarPedidos(db, azul.restaurant, "salon");
    assert.equal(salon.tables?.length, azul.mesas.length);
    for (const mesa of salon.tables ?? []) {
      assert.equal(mesa.restaurant_id, azul.restaurant.id);
    }
    const idsDeLanzhou = new Set(lanzhou.mesas.map((m) => m.id));
    assert.ok(!salon.tables?.some((m) => idsDeLanzhou.has(m.id)));
  });

  it("cada local lleva su propia cuenta del día: los dos empiezan en #1", () => {
    const { db, azul, lanzhou } = dosLocales();

    const a1 = crearPedido(db, azul.restaurant, azul.mesas[0], {
      items: [{ id: azul.platos["Ceviche"].id, quantity: 1 }],
    });
    const l1 = crearPedido(db, lanzhou.restaurant, lanzhou.mesas[0], {
      items: [{ id: lanzhou.platos["牛肉拉面"].id, quantity: 1 }],
    });
    const a2 = crearPedido(db, azul.restaurant, azul.mesas[1], {
      items: [{ id: azul.platos["Ceviche"].id, quantity: 1 }],
    });

    assert.equal(a1.dailyNumber, 1);
    assert.equal(l1.dailyNumber, 1, "el pedido de Punto Azul no debe correr el número de Lanzhou");
    assert.equal(a2.dailyNumber, 2);
  });

  it("el pedido sabe qué local lo cocina", () => {
    const { db, lanzhou } = dosLocales();
    const { id } = crearPedido(db, lanzhou.restaurant, lanzhou.mesas[0], {
      items: [{ id: lanzhou.platos["牛肉拉面"].id, quantity: 1 }],
    });

    const visto = verPedido(db, id);
    assert.equal(visto?.restaurant.slug, "lanzhou-noodles");
  });
});

describe("el precio lo pone la carta, no el navegador", () => {
  it("el total se calcula con el precio de la base", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, {
      slug: "jugueria",
      carta: [
        { nombre: "Jugo", precio: 800 },
        { nombre: "Sánguche", precio: 1200 },
      ],
    });

    const pedido = crearPedido(db, local.restaurant, local.mesas[0], {
      items: [
        { id: local.platos["Jugo"].id, quantity: 3 },
        { id: local.platos["Sánguche"].id, quantity: 2 },
      ],
    });

    assert.equal(pedido.totalCents, 800 * 3 + 1200 * 2);
  });

  it("un plato agotado tumba el pedido entero", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, {
      slug: "menu",
      carta: [
        { nombre: "Hay", precio: 500 },
        { nombre: "Se acabó", precio: 500, disponible: false },
      ],
    });

    assert.throws(
      () =>
        crearPedido(db, local.restaurant, local.mesas[0], {
          items: [
            { id: local.platos["Hay"].id, quantity: 1 },
            { id: local.platos["Se acabó"].id, quantity: 1 },
          ],
        }),
      (e: unknown) => e instanceof ErrorDePedido && e.status === 409
    );

    // Y no deja media comanda suelta en la cocina.
    assert.equal(listarPedidos(db, local.restaurant, "kitchen").orders.length, 0);
  });

  it("un local suspendido no recibe pedidos", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, { slug: "moroso", activo: false });

    assert.throws(
      () =>
        crearPedido(db, local.restaurant, local.mesas[0], {
          items: [{ id: local.platos["Ceviche"].id, quantity: 1 }],
        }),
      (e: unknown) => e instanceof ErrorDePedido && e.status === 403
    );
  });

  it("las cantidades imposibles no pasan", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, { slug: "cevicheria" });
    const plato = local.platos["Ceviche"].id;

    for (const quantity of [0, -1, 51, NaN]) {
      assert.throws(
        () =>
          crearPedido(db, local.restaurant, local.mesas[0], {
            items: [{ id: plato, quantity }],
          }),
        (e: unknown) => e instanceof ErrorDePedido && e.status === 400,
        `la cantidad ${quantity} debería rechazarse`
      );
    }
  });

  it("el pedido vacío no llega a la cocina", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, { slug: "vacio" });

    assert.throws(
      () => crearPedido(db, local.restaurant, local.mesas[0], { items: [] }),
      (e: unknown) => e instanceof ErrorDePedido && e.status === 400
    );
  });
});
