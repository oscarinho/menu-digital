import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessDayRange } from "@/lib/db";
import { crearPedido, listarPedidos } from "@/domain/pedidos";
import { baseTemporal, fecharPedido, sembrarLocal } from "./local";

// "Hoy" no es el día de UTC: es el día del local.
//
// En Lima (UTC-5) el día UTC cambia a las 7 de la tarde, en plena cena. Si "hoy"
// fuera UTC, al pedido #14 le seguiría el #1 a media noche de trabajo y las cuentas
// del día se partirían en dos. Esto ya se arregló; estos tests son para que no
// vuelva.

describe("el día del local", () => {
  it("en Lima, el día empieza a medianoche de Lima (05:00 UTC)", () => {
    // 14 jul 2026, 18:00 en Lima = 23:00 UTC del mismo día.
    const { start, end } = businessDayRange("America/Lima", new Date("2026-07-14T23:00:00Z"));
    assert.equal(start, "2026-07-14 05:00:00");
    assert.equal(end, "2026-07-15 05:00:00");
  });

  it("las 8 de la noche en Lima siguen siendo el mismo día, aunque en UTC ya sea mañana", () => {
    // 20:00 en Lima del día 14 = 01:00 UTC del 15. El día del local NO ha cambiado.
    const cena = new Date("2026-07-15T01:00:00Z");
    const { start, end } = businessDayRange("America/Lima", cena);
    assert.equal(start, "2026-07-14 05:00:00", "en Lima sigue siendo el día 14");
    assert.ok(start <= "2026-07-15 01:00:00" && "2026-07-15 01:00:00" < end);
  });

  it("cada local tiene su día: Lima y Madrid no cambian de día a la vez", () => {
    const instante = new Date("2026-07-14T23:00:00Z"); // 18:00 en Lima · 01:00 del 15 en Madrid
    const lima = businessDayRange("America/Lima", instante);
    const madrid = businessDayRange("Europe/Madrid", instante);

    assert.equal(lima.start, "2026-07-14 05:00:00");
    assert.equal(madrid.start, "2026-07-14 22:00:00", "en Madrid ya empezó el día 15");
    assert.notEqual(lima.start, madrid.start);
  });

  it("una zona horaria inválida no tumba el servicio del local", () => {
    // Si alguien mete basura en la BD, el local sigue vendiendo: cae a Lima.
    const instante = new Date("2026-07-14T23:00:00Z");
    assert.deepEqual(
      businessDayRange("Marte/Olympus", instante),
      businessDayRange("America/Lima", instante)
    );
  });

  it("el pedido de anoche no corre el número de hoy", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, { slug: "cevicheria" });

    const anoche = crearPedido(db, local.restaurant, local.mesas[0], {
      items: [{ id: local.platos["Ceviche"].id, quantity: 1 }],
    });
    assert.equal(anoche.dailyNumber, 1);
    fecharPedido(db, anoche.id, {
      creado: "2020-01-01 12:00:00",
      tocado: "2020-01-01 12:30:00",
    });

    // El primero de hoy vuelve a ser el #1: el comensal oye "número uno", no
    // "número dos mil".
    const hoy = crearPedido(db, local.restaurant, local.mesas[1], {
      items: [{ id: local.platos["Ceviche"].id, quantity: 1 }],
    });
    assert.equal(hoy.dailyNumber, 1);
  });

  it("el pedido de anoche sin cobrar sigue en la caja de hoy", () => {
    const db = baseTemporal();
    const local = sembrarLocal(db, { slug: "cevicheria" });

    const viejo = crearPedido(db, local.restaurant, local.mesas[0], {
      items: [{ id: local.platos["Ceviche"].id, quantity: 1 }],
    });
    fecharPedido(db, viejo.id, {
      creado: "2020-01-01 12:00:00",
      tocado: "2020-01-01 12:00:00",
    });

    // Una deuda no caduca a medianoche: si nadie lo cobró, la caja lo sigue viendo.
    const caja = listarPedidos(db, local.restaurant, "caja");
    assert.equal(caja.orders.length, 1);
    assert.equal(caja.orders[0].id, viejo.id);
  });
});
