"use client";

import { use, useEffect, useState } from "react";
import StaffGate from "@/app/components/StaffGate";
import { useKeepAwake } from "@/lib/keep-awake";
import { formatMoney } from "@/lib/money";
import { getPaymentMethods, paymentLabel } from "@/lib/payments";
import type { OrderWithDetails } from "@/lib/types";

const GRID = "1.1fr 1fr 1.4fr .9fr";

function CajaBoard({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [currency, setCurrency] = useState("PEN");
  const [country, setCountry] = useState("PE");
  const [charging, setCharging] = useState<string | null>(null);

  useKeepAwake();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders?slug=${slug}&view=caja`, {
          cache: "no-store",
        });
        const d = await res.json();
        if (alive && res.ok) {
          setOrders(d.orders);
          setCurrency(d.currency);
          setCountry(d.country ?? "PE");
        }
      } catch {
        /* siguiente intento en 4s */
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug]);

  const claimedCount = orders.filter((o) => o.payment_status === "claimed").length;
  const pendingTotal = orders.reduce((s, o) => s + o.total_cents, 0);
  // Los métodos salen del país del local, no de un "PE" fijo: el día que haya un
  // cliente fuera de Perú, la caja no debe ofrecerle Yape.
  const methods = getPaymentMethods(country);

  async function markPaid(orderId: string, method: string) {
    setOrders((os) => os.filter((o) => o.id !== orderId));
    setCharging(null);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method }),
    });
  }

  return (
    <div className="flex flex-1 flex-col px-5 py-7" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-5xl">
        <div
          className="overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            boxShadow: "0 40px 90px -55px rgba(33,29,24,.5)",
          }}
        >
          {/* Cabecera */}
          <header
            className="flex flex-wrap items-center gap-3.5 px-6 py-[18px]"
            style={{ borderBottom: "1px solid var(--border-2)" }}
          >
            <span
              className="flex h-[34px] w-[34px] items-center justify-center"
              style={{ borderRadius: 9, background: "var(--brand)" }}
              aria-hidden
            >
              💳
            </span>
            <h1 className="text-[19px] font-extrabold" style={{ color: "var(--text)" }}>
              Caja · {slug}
            </h1>
            <span className="text-sm font-semibold" style={{ color: "var(--text-faint)" }}>
              {formatMoney(pendingTotal, currency)} por cobrar
            </span>
            {claimedCount > 0 && (
              <span
                className="ml-auto inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-extrabold"
                style={{
                  borderRadius: 999,
                  background: "var(--warning-soft)",
                  color: "var(--warning)",
                }}
              >
                🔔 {claimedCount} pago{claimedCount !== 1 && "s"} por confirmar
              </span>
            )}
          </header>

          {/* Encabezado de columnas */}
          <div
            className="hidden gap-4 px-6 py-3 text-xs font-extrabold uppercase tracking-[0.06em] md:grid"
            style={{
              gridTemplateColumns: GRID,
              background: "var(--surface-2)",
              color: "var(--text-faint)",
            }}
          >
            <div>Mesa / pedido</div>
            <div>Total</div>
            <div>Estado de cobro</div>
            <div className="text-right">Acción</div>
          </div>

          {orders.length === 0 && (
            <p
              className="py-16 text-center font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              No hay cuentas abiertas 🎉
            </p>
          )}

          {orders.map((o) => {
            const claimed = o.payment_status === "claimed";
            const open = charging === o.id;
            return (
              <div
                key={o.id}
                className="grid items-center gap-4 px-6 py-[18px]"
                style={{
                  gridTemplateColumns: GRID,
                  borderTop: "1px solid var(--border-2)",
                  background: claimed ? "var(--warning-soft)" : "transparent",
                }}
              >
                {/* Mesa / pedido */}
                <div className="flex items-center gap-3">
                  {claimed && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: "var(--warning)" }}
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className="truncate text-[19px] font-extrabold leading-tight"
                      style={{
                        color: "var(--text)",
                        fontFamily: "var(--font-display), system-ui, sans-serif",
                      }}
                    >
                      {o.table_label}
                    </p>
                    <p
                      className="text-[12.5px] font-semibold"
                      style={{ color: "var(--text-faint)" }}
                    >
                      #{o.daily_number} · {o.items.reduce((s, it) => s + it.quantity, 0)} ítems
                    </p>
                  </div>
                </div>

                {/* Total */}
                <p
                  className="text-xl font-extrabold tabular-nums"
                  style={{
                    color: "var(--text)",
                    fontFamily: "var(--font-display), system-ui, sans-serif",
                  }}
                >
                  {formatMoney(o.total_cents, currency)}
                </p>

                {/* Estado de cobro */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {o.payment_method && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-[13px] font-bold"
                      style={{
                        borderRadius: 999,
                        background: "var(--neutral-soft)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {paymentLabel(o.payment_method)}
                    </span>
                  )}
                  <span
                    className="px-3 py-1 text-[12.5px] font-extrabold"
                    style={{
                      borderRadius: 999,
                      background: claimed ? "var(--info-soft)" : "var(--neutral-soft)",
                      color: claimed ? "var(--info)" : "var(--neutral)",
                    }}
                  >
                    {claimed ? "Pago informado" : "Por cobrar"}
                  </span>
                </div>

                {/* Acción */}
                <div className="text-right">
                  {claimed ? (
                    <button
                      onClick={() => markPaid(o.id, o.payment_method)}
                      className="px-4 py-3 text-sm font-extrabold text-white transition active:scale-[0.96]"
                      style={{ borderRadius: 12, background: "var(--success)" }}
                    >
                      Confirmar pago ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => setCharging(open ? null : o.id)}
                      className="px-4 py-3 text-sm font-extrabold transition active:scale-[0.96]"
                      style={{
                        borderRadius: 12,
                        background: open ? "var(--neutral-soft)" : "var(--brand)",
                        color: open ? "var(--text)" : "var(--brand-contrast)",
                      }}
                    >
                      {open ? "Cancelar" : "Cobrar"}
                    </button>
                  )}
                </div>

                {/* Selector de método (al pulsar "Cobrar") */}
                {open && (
                  <div
                    className="col-span-full flex flex-wrap gap-2 pt-1"
                    style={{ animation: "reveal .18s ease both" }}
                  >
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => markPaid(o.id, m.id)}
                        className="px-4 py-2.5 text-sm font-bold transition active:scale-[0.96]"
                        style={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      >
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CajaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} title="Caja">
      <CajaBoard slug={slug} />
    </StaffGate>
  );
}
