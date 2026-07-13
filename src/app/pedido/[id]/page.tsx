"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { forgetOrder, isOrderOpen } from "@/lib/active-order";
import { STATUS_TONE, brandVars, initialsOf } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import { isInAppMethod, paymentLabel } from "@/lib/payments";
import { ORDER_FLOW, ORDER_STATUS_LABELS, type OrderWithDetails } from "@/lib/types";

interface TrackingData {
  order: OrderWithDetails;
  currency: string;
  restaurantName: string;
  restaurantSlug: string;
  branding: { logo: string; brandColor: string };
  payment: { yapeNumber: string; plinNumber: string; qr: string };
  demo?: boolean;
}

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-2)",
  borderRadius: 24,
  boxShadow: "0 14px 30px -26px rgba(33,29,24,.4)",
};

export default function PedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        if (!res.ok) setError(d.error ?? "Error");
        else {
          setData(d);
          // Cerrado el ciclo (entregado y pagado, o cancelado), la mesa deja de
          // arrastrarlo: al volver a escanear el QR se empieza de cero.
          if (!isOrderOpen(d.order)) {
            forgetOrder(d.restaurantSlug, d.order.table_code);
          }
        }
      } catch {
        if (alive) setError("Sin conexión");
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  async function claimPayment() {
    if (claiming || !data) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimPayment: true }),
      });
      const d = await res.json();
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, order: { ...prev.order, ...d.order } } : prev));
      }
    } finally {
      setClaiming(false);
    }
  }

  if (error && !data) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-8 text-center font-semibold"
        style={{ background: "var(--bg)", color: "var(--text-muted)" }}
      >
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--text-faint)" }}
      >
        Cargando pedido…
      </div>
    );
  }

  const { order, currency, payment } = data;
  const cancelled = order.status === "cancelled";
  const currentStep = ORDER_FLOW.indexOf(order.status);
  const tone = STATUS_TONE[order.status];
  const method = order.payment_method;
  const inApp = isInAppMethod(method);
  const payNumber =
    method === "plin" && payment.plinNumber
      ? payment.plinNumber
      : payment.yapeNumber || payment.plinNumber;
  const showPayPanel =
    !cancelled && inApp && order.payment_status === "unpaid" && (payNumber || payment.qr);

  return (
    <div
      className="flex flex-1 justify-center px-5 py-8"
      style={{ ...brandVars(data.branding?.brandColor), background: "var(--bg)" }}
    >
      <div className="w-full max-w-md" style={{ animation: "reveal .35s ease both" }}>
        {/* Cabecera del local */}
        <header className="flex items-center gap-3">
          {data.branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.branding.logo}
              alt=""
              className="h-11 w-11 shrink-0 object-cover"
              style={{ borderRadius: 12, border: "1px solid var(--border-2)" }}
            />
          ) : (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center text-lg font-extrabold"
              style={{
                borderRadius: 12,
                background: "var(--brand)",
                color: "var(--brand-contrast)",
                fontFamily: "var(--font-display), system-ui, sans-serif",
              }}
            >
              {initialsOf(data.restaurantName)}
            </span>
          )}
          <div className="min-w-0">
            <h1
              className="truncate text-[18px] font-extrabold leading-tight"
              style={{ color: "var(--text)" }}
            >
              {data.restaurantName}
            </h1>
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-faint)" }}
            >
              Pedido #{order.daily_number} · {order.table_label}
            </p>
          </div>
        </header>

        {/* Estado actual + línea de tiempo */}
        <section className="mt-5 p-[22px]" style={CARD}>
          <p
            className="text-[13px] font-extrabold uppercase tracking-[0.1em]"
            style={{ color: "var(--text-faint)" }}
          >
            Estado actual
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ background: tone.color, boxShadow: `0 0 0 5px ${tone.soft}` }}
            />
            <h2 className="text-[26px] font-extrabold leading-none" style={{ color: "var(--text)" }}>
              {ORDER_STATUS_LABELS[order.status]}
            </h2>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {tone.hint}
          </p>

          {!cancelled && (
            <ol className="mt-6">
              {ORDER_FLOW.map((status, i) => {
                const done = i <= currentStep;
                const active = i === currentStep;
                const last = i === ORDER_FLOW.length - 1;
                return (
                  <li key={status} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <span
                        className="flex h-[30px] w-[30px] items-center justify-center text-sm font-extrabold"
                        style={{
                          borderRadius: 999,
                          background: done ? "var(--brand)" : "var(--surface)",
                          color: done ? "var(--brand-contrast)" : "var(--text-faint)",
                          border: `2px solid ${done ? "var(--brand)" : "var(--border-2)"}`,
                          boxShadow: active
                            ? "0 0 0 5px color-mix(in oklab, var(--brand), transparent 85%)"
                            : "none",
                          animation: active ? "pop .35s ease both" : "none",
                        }}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {!last && (
                        <span
                          className="w-[2px] flex-1"
                          style={{
                            minHeight: 26,
                            background: i < currentStep ? "var(--brand)" : "var(--border-2)",
                          }}
                        />
                      )}
                    </div>
                    <div className={last ? "pt-1" : "pb-3 pt-1"}>
                      <p
                        className="text-[15px] font-extrabold"
                        style={{ color: done ? "var(--text)" : "var(--text-faint)" }}
                      >
                        {ORDER_STATUS_LABELS[status]}
                      </p>
                      {active && !last && (
                        <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                          En curso…
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Pago dentro de la app: QR + "Ya pagué" */}
        {showPayPanel && (
          <section className="mt-4 p-[22px]" style={CARD}>
            {data.demo && (
              <p
                className="mb-3 px-3 py-2 text-[12.5px] font-extrabold"
                style={{
                  borderRadius: 11,
                  background: "var(--warning-soft)",
                  color: "var(--warning)",
                }}
              >
                ⚠️ Demo — el número de abajo es ficticio. No transfieras dinero.
              </p>
            )}
            <h3 className="text-[19px] font-extrabold" style={{ color: "var(--text)" }}>
              Paga con {paymentLabel(method)}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {payment.qr ? "Escanea el QR o usa el número, transfiere " : "Transfiere "}
              <strong style={{ color: "var(--text)" }}>
                {formatMoney(order.total_cents, currency)}
              </strong>{" "}
              y confirma.
            </p>
            {payment.qr && (
              <div className="my-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={payment.qr}
                  alt={`QR de pago ${paymentLabel(method)}`}
                  className="h-[170px] w-[170px] object-contain p-3"
                  style={{
                    borderRadius: 18,
                    background: "var(--surface)",
                    border: "1px solid var(--border-2)",
                  }}
                />
              </div>
            )}
            {payNumber && (
              <p
                className="text-center text-[13px]"
                style={{ color: "var(--text-faint)", marginTop: payment.qr ? 0 : 16 }}
              >
                Titular{" "}
                <strong style={{ color: "var(--text)" }}>{data.restaurantName}</strong> ·{" "}
                <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                  {payNumber}
                </strong>
              </p>
            )}
            <button
              onClick={claimPayment}
              disabled={claiming}
              className="mt-4 w-full p-[15px] text-[15px] font-extrabold transition active:scale-[0.98] disabled:opacity-60"
              style={{
                borderRadius: 15,
                background: "var(--brand)",
                color: "var(--brand-contrast)",
              }}
            >
              {claiming ? "Avisando…" : "Ya pagué"}
            </button>
          </section>
        )}

        {/* Pago informado: esperando a caja */}
        {!cancelled && order.payment_status === "claimed" && (
          <section className="mt-4 p-[22px] text-center" style={CARD}>
            <span
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center text-[32px]"
              style={{
                borderRadius: 999,
                background: "var(--success-soft)",
                color: "var(--success)",
                animation: "pop .4s ease both",
              }}
            >
              ✓
            </span>
            <h3 className="text-xl font-extrabold" style={{ color: "var(--text)" }}>
              Pago informado
            </h3>
            <p
              className="mx-auto mt-1.5 max-w-[30ch] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Avisamos a caja. En cuanto confirmen la transferencia lo verás como{" "}
              <strong style={{ color: "var(--success)" }}>Pagado</strong>.
            </p>
            <span
              className="mt-3.5 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-extrabold"
              style={{
                borderRadius: 999,
                background: "var(--warning-soft)",
                color: "var(--warning)",
              }}
            >
              Esperando confirmación de caja
            </span>
          </section>
        )}

        {/* Pago confirmado por caja */}
        {order.payment_status === "paid" && (
          <p
            className="mt-4 p-4 text-center text-sm font-extrabold"
            style={{
              borderRadius: 24,
              background: "var(--success-soft)",
              color: "var(--success)",
            }}
          >
            Pago confirmado con {paymentLabel(order.payment_method)} ✓ ¡Gracias!
          </p>
        )}

        {/* Efectivo o tarjeta: se cobra en la mesa */}
        {!cancelled && order.payment_status === "unpaid" && !inApp && (
          <div className="mt-4 flex items-center gap-3 px-[22px] py-5" style={CARD}>
            <span className="text-[22px]" aria-hidden>
              💵
            </span>
            <div>
              <p className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
                Pago {method ? `con ${paymentLabel(method)}` : "en el local"}
              </p>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                Se cobra en la mesa · total {formatMoney(order.total_cents, currency)}
              </p>
            </div>
          </div>
        )}

        {/* Detalle del pedido */}
        <section className="mt-4 p-[22px]" style={CARD}>
          <h3
            className="text-[13px] font-extrabold uppercase tracking-[0.1em]"
            style={{ color: "var(--text-faint)" }}
          >
            Tu pedido
          </h3>
          <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-extrabold" style={{ color: "var(--text)" }}>
                    {it.quantity}×
                  </span>{" "}
                  {it.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(it.unit_price_cents * it.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
          {order.notes && (
            <p
              className="mt-3 px-3 py-2 text-[13px] font-semibold"
              style={{
                borderRadius: 11,
                background: "var(--warning-soft)",
                color: "var(--warning)",
              }}
            >
              📝 {order.notes}
            </p>
          )}
          <div
            className="mt-3 flex justify-between pt-3 text-lg font-extrabold"
            style={{
              borderTop: "1px solid var(--border-2)",
              color: "var(--text)",
              fontFamily: "var(--font-display), system-ui, sans-serif",
            }}
          >
            <span>Total</span>
            <span style={{ color: "var(--brand)" }}>
              {formatMoney(order.total_cents, currency)}
            </span>
          </div>
        </section>

        <Link
          href={`/r/${data.restaurantSlug}/mesa/${order.table_code}`}
          className="mt-4 block w-full py-3.5 text-center text-[15px] font-extrabold transition active:scale-[0.98]"
          style={{
            borderRadius: 15,
            background: "var(--surface)",
            border: "1px solid var(--border-2)",
            color: "var(--text)",
          }}
        >
          Pedir algo más
        </Link>

        <p className="mt-4 text-center text-xs" style={{ color: "var(--text-faint)" }}>
          Esta página se actualiza sola cada pocos segundos.
        </p>
      </div>
    </div>
  );
}
