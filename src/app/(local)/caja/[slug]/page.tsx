"use client";

import { use, useEffect, useState } from "react";
import LangSwitch from "@/components/LangSwitch";
import StaffGate from "@/components/StaffGate";
import { fmt, payLabel, useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import { formatMoney } from "@/lib/money";
import { getPaymentMethods } from "@/lib/payments";
import type { OrderWithDetails } from "@/lib/types";

const GRID = "1.1fr 1fr 1.4fr .9fr";

// SQLite devuelve 'YYYY-MM-DD HH:MM:SS' en UTC.
function hourOf(ts: string): string {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CajaBoard({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("caja");
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

  // Cuentas abiertas arriba, cobradas hoy abajo. El cobro no borra el pedido: la
  // caja necesita poder mirar atrás ("¿la mesa 3 pagó?", "¿cuánto llevamos?").
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
              {t.nav.caja} · {slug}
            </h1>
            <span className="text-sm font-semibold" style={{ color: "var(--text-faint)" }}>
              {fmt(t.caja.toCharge, { amount: formatMoney(pendingTotal, currency) })}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {claimedCount > 0 && (
                <span
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-extrabold"
                  style={{
                    borderRadius: 999,
                    background: "var(--warning-soft)",
                    color: "var(--warning)",
                  }}
                >
                  {fmt(claimedCount === 1 ? t.caja.claimed1 : t.caja.claimedN, {
                    n: claimedCount,
                  })}
                </span>
              )}
              <LangSwitch lang={lang} onChange={setLang} />
            </div>
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
            <div>{t.caja.colTable}</div>
            <div>{t.caja.colTotal}</div>
            <div>{t.caja.colState}</div>
            <div className="text-right">{t.caja.colAction}</div>
          </div>

          {open.length === 0 && (
            <p
              className="py-16 text-center font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              {t.caja.noOpen}
            </p>
          )}

          {open.map((o) => {
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
                      #{o.daily_number} ·{" "}
                      {fmt(t.caja.items, {
                        n: o.items.reduce((s, it) => s + it.quantity, 0),
                      })}
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
                      {payLabel(t, o.payment_method)}
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
                    {claimed ? t.caja.claimedChip : t.caja.toChargeChip}
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
                      {t.caja.confirm}
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
                      {open ? t.caja.cancel : t.caja.charge}
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
                        {m.icon} {payLabel(t, m.id)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cobrados hoy: el pedido no se evapora al confirmarlo. Queda el registro
            del día y el total, que es lo que la caja cuadra al cerrar. */}
        {paid.length > 0 && (
          <div
            className="mt-5 overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 24,
            }}
          >
            <header
              className="flex flex-wrap items-center gap-3 px-6 py-[18px]"
              style={{ borderBottom: "1px solid var(--border-2)" }}
            >
              <h2
                className="text-[15px] font-extrabold uppercase tracking-[0.05em]"
                style={{ color: "var(--text-muted)" }}
              >
                {t.caja.paidToday}
              </h2>
              <span
                className="px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums"
                style={{
                  borderRadius: 999,
                  background: "var(--success-soft)",
                  color: "var(--success)",
                }}
              >
                {paid.length}
              </span>
              <span
                className="ml-auto text-lg font-extrabold tabular-nums"
                style={{
                  color: "var(--text)",
                  fontFamily: "var(--font-display), system-ui, sans-serif",
                }}
              >
                {formatMoney(paidTotal, currency)}
              </span>
            </header>

            {paid.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-3.5"
                style={{ borderTop: "1px solid var(--border-2)" }}
              >
                <span
                  className="text-[15px] font-extrabold"
                  style={{
                    color: "var(--text)",
                    fontFamily: "var(--font-display), system-ui, sans-serif",
                  }}
                >
                  {o.table_label}
                </span>
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: "var(--text-faint)" }}
                >
                  #{o.daily_number} · {hourOf(o.updated_at)}
                </span>
                {o.payment_method && (
                  <span
                    className="px-3 py-1 text-[12.5px] font-bold"
                    style={{
                      borderRadius: 999,
                      background: "var(--neutral-soft)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {payLabel(t, o.payment_method)}
                  </span>
                )}
                <span
                  className="ml-auto text-base font-extrabold tabular-nums"
                  style={{ color: "var(--success)" }}
                >
                  {formatMoney(o.total_cents, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
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
    <StaffGate slug={slug} surface="caja">
      <CajaBoard slug={slug} />
    </StaffGate>
  );
}
