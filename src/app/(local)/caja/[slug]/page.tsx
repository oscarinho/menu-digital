"use client";

import { use, useEffect, useState } from "react";
import StaffGate from "@/components/StaffGate";
import StaffShell, { type Marca } from "@/components/StaffShell";
import { IconCheck, IconEquis } from "@/components/icons";
import { fmt, payLabel, useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import { formatMoney } from "@/lib/money";
import { getPaymentMethods } from "@/lib/payments";
import type { OrderWithDetails } from "@/lib/types";

// La caja.
//
// Antes era una tabla con cabeceras de columna, como una hoja de cálculo. Un cajero
// no lee columnas: busca una mesa, mira cuánto, cobra y pasa a la siguiente. Así que
// ahora manda el dinero —las dos cifras del día arriba, grandes— y cada cuenta es una
// fila que se toca con el pulgar, no una celda.
//
// Lo que el cliente dice haber pagado por Yape se resalta en ámbar: es lo único que
// obliga a mirar el celular y comprobar que la plata llegó de verdad.

function hourOf(ts: string): string {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CajaBoard({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("caja");
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [restaurant, setRestaurant] = useState<Marca | null>(null);
  const [currency, setCurrency] = useState("PEN");
  const [country, setCountry] = useState("PE");
  const [charging, setCharging] = useState<string | null>(null);

  useKeepAwake();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders?slug=${slug}&view=caja`, { cache: "no-store" });
        const d = await res.json();
        if (alive && res.ok) {
          setOrders(d.orders);
          setRestaurant(d.restaurant ?? null);
          setCurrency(d.currency);
          setCountry(d.country ?? "PE");
        }
      } catch {
        /* siguiente intento en 4s */
      }
    }
    load();
    const timer = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [slug]);

  // Cuentas abiertas arriba, cobradas hoy abajo. El cobro no borra el pedido: la caja
  // necesita poder mirar atrás ("¿la mesa 3 pagó?", "¿cuánto llevamos?").
  const open = orders.filter((o) => o.payment_status !== "paid");
  const paid = orders
    .filter((o) => o.payment_status === "paid")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const claimedCount = open.filter((o) => o.payment_status === "claimed").length;
  const pendingTotal = open.reduce((s, o) => s + o.total_cents, 0);
  const paidTotal = paid.reduce((s, o) => s + o.total_cents, 0);
  // Los métodos salen del país del local, no de un "PE" fijo: el día que haya un
  // cliente fuera de Perú, la caja no debe ofrecerle Yape.
  const methods = getPaymentMethods(country);

  async function markPaid(orderId: string, method: string) {
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payment_status: "paid" as const,
              payment_method: method,
              updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
            }
          : o
      )
    );
    setCharging(null);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method }),
    });
  }

  const cifra = (rotulo: string, valor: string, color: string) => (
    <div
      className="flex-1 px-5 py-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 18,
      }}
    >
      <p
        className="text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
        style={{ color: "var(--text-faint)" }}
      >
        {rotulo}
      </p>
      <p
        className="mt-1 text-[28px] font-extrabold leading-none tabular-nums"
        style={{ color, fontFamily: "var(--font-display), system-ui, sans-serif" }}
      >
        {valor}
      </p>
    </div>
  );

  return (
    <StaffShell
      slug={slug}
      surface="caja"
      restaurant={restaurant}
      t={t}
      lang={lang}
      onLang={setLang}
    >
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {/* Las dos cifras del día: la primera pregunta del cajero y también la
            última. Cuánto falta por cobrar y cuánto ha entrado. */}
        <div className="flex flex-wrap gap-3">
          {cifra(t.caja.colTotal, formatMoney(pendingTotal, currency), "var(--text)")}
          {cifra(t.caja.paidToday, formatMoney(paidTotal, currency), "var(--success)")}
        </div>

        {claimedCount > 0 && (
          <p
            className="mt-3 px-4 py-3 text-[13.5px] font-extrabold"
            style={{
              borderRadius: 14,
              background: "var(--warning-soft)",
              color: "var(--warning)",
            }}
          >
            {fmt(claimedCount === 1 ? t.caja.claimed1 : t.caja.claimedN, { n: claimedCount })}
          </p>
        )}

        <h2
          className="mt-8 text-[12px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          {t.caja.colState}
        </h2>

        {open.length === 0 && (
          <p
            className="mt-3 py-14 text-center text-sm font-bold"
            style={{
              borderRadius: 18,
              border: "2px dashed var(--border-2)",
              color: "var(--text-faint)",
            }}
          >
            {t.caja.noOpen}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2.5">
          {open.map((o) => {
            const claimed = o.payment_status === "claimed";
            const eligiendo = charging === o.id;
            return (
              <article
                key={o.id}
                className="overflow-hidden"
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${claimed ? "var(--warning)" : "var(--border-2)"}`,
                  borderRadius: 18,
                  boxShadow: claimed ? "0 14px 30px -24px rgba(180,83,9,.6)" : "none",
                }}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[20px] font-extrabold leading-tight"
                      style={{
                        color: "var(--text)",
                        fontFamily: "var(--font-display), system-ui, sans-serif",
                      }}
                    >
                      {o.table_label || o.customer_name || `#${o.daily_number}`}
                    </p>
                    <p
                      className="mt-0.5 text-[12.5px] font-semibold"
                      style={{ color: "var(--text-faint)" }}
                    >
                      #{o.daily_number} ·{" "}
                      {fmt(t.caja.items, { n: o.items.reduce((s, it) => s + it.quantity, 0) })}
                      {o.payment_method && ` · ${payLabel(t, o.payment_method)}`}
                    </p>
                  </div>

                  {/* El estado solo se dice cuando dice algo: poner "por cobrar" en una
                      cuenta abierta es ruido. Lo que importa es lo que el cliente jura
                      haber pagado ya. */}
                  {claimed && (
                    <span
                      className="px-3 py-1.5 text-[12px] font-extrabold"
                      style={{
                        borderRadius: 999,
                        background: "var(--warning-soft)",
                        color: "var(--warning)",
                      }}
                    >
                      {t.caja.claimedChip}
                    </span>
                  )}

                  <p
                    className="text-[24px] font-extrabold tabular-nums"
                    style={{
                      color: "var(--text)",
                      fontFamily: "var(--font-display), system-ui, sans-serif",
                    }}
                  >
                    {formatMoney(o.total_cents, currency)}
                  </p>

                  {claimed ? (
                    <button
                      onClick={() => markPaid(o.id, o.payment_method)}
                      className="flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold text-white transition active:scale-[0.96]"
                      style={{ borderRadius: 13, background: "var(--success)" }}
                    >
                      <IconCheck size={17} />
                      {t.caja.confirm}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCharging(eligiendo ? null : o.id)}
                      className="flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold transition active:scale-[0.96]"
                      style={{
                        borderRadius: 13,
                        background: eligiendo ? "var(--neutral-soft)" : "var(--brand)",
                        color: eligiendo ? "var(--text)" : "var(--brand-contrast)",
                      }}
                    >
                      {eligiendo && <IconEquis size={16} />}
                      {eligiendo ? t.caja.cancel : t.caja.charge}
                    </button>
                  )}
                </div>

                {/* Con qué pagó. Aparece al pulsar "Cobrar" y ocupa el ancho entero:
                    botones grandes, porque se tocan con prisa y casi sin mirar. */}
                {eligiendo && (
                  <div
                    className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5"
                    style={{ animation: "reveal .18s ease both" }}
                  >
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => markPaid(o.id, m.id)}
                        className="flex-1 px-4 py-3.5 text-sm font-extrabold transition active:scale-[0.96]"
                        style={{
                          borderRadius: 13,
                          border: "1px solid var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--text)",
                        }}
                      >
                        {m.icon} {payLabel(t, m.id)}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Cobrados hoy: el pedido no se evapora al confirmarlo. Queda el registro del
            día, que es lo que la caja cuadra al cerrar. */}
        {paid.length > 0 && (
          <>
            <h2
              className="mt-10 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.12em]"
              style={{ color: "var(--text-faint)" }}
            >
              {t.caja.paidToday}
              <span
                className="flex h-5 min-w-[20px] items-center justify-center px-1.5 text-[12px] tabular-nums"
                style={{
                  borderRadius: 999,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                }}
              >
                {paid.length}
              </span>
            </h2>

            <div
              className="mt-3 overflow-hidden"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                borderRadius: 18,
              }}
            >
              {paid.map((o, i) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-2)" }}
                >
                  <span className="shrink-0" style={{ color: "var(--success)" }}>
                    <IconCheck size={15} />
                  </span>
                  <span
                    className="text-[15px] font-extrabold"
                    style={{
                      color: "var(--text)",
                      fontFamily: "var(--font-display), system-ui, sans-serif",
                    }}
                  >
                    {o.table_label || o.customer_name || `#${o.daily_number}`}
                  </span>
                  <span
                    className="text-[12.5px] font-semibold tabular-nums"
                    style={{ color: "var(--text-faint)" }}
                  >
                    #{o.daily_number} · {hourOf(o.updated_at)}
                    {o.payment_method && ` · ${payLabel(t, o.payment_method)}`}
                  </span>
                  <span
                    className="ml-auto text-[16px] font-extrabold tabular-nums"
                    style={{ color: "var(--text)" }}
                  >
                    {formatMoney(o.total_cents, currency)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </StaffShell>
  );
}

export default function CajaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} surface="caja">
      <CajaBoard slug={slug} />
    </StaffGate>
  );
}
