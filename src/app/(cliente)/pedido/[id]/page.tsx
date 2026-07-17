"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { forgetOrder, isOrderOpen } from "@/lib/active-order";
import { STATUS_TONE, brandVars, initialsOf } from "@/lib/brand";
import { fmt, payLabel, useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { isInAppMethod } from "@/lib/payments";
import { ORDER_FLOW, type OrderWithDetails } from "@/lib/types";

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

// Reduce una imagen a `maxLado` px de lado mayor y la devuelve como data URI JPEG.
// Todo en el navegador: nada de esto sube el archivo original a ningún lado.
function reducirImagen(file: File, maxLado: number, calidad: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("sin canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagen ilegible"));
    };
    img.src = url;
  });
}

export default function PedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [t, lang, setLang] = useT("track");
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  // La captura del pago que el comensal adjunta, ya reducida a data URI.
  const [proof, setProof] = useState<string | null>(null);
  const [readingProof, setReadingProof] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        if (!res.ok) setError(t.menu.loadError);
        else {
          setData(d);
          // Cerrado el ciclo (entregado y pagado, o cancelado), la mesa deja de
          // arrastrarlo: al volver a escanear el QR se empieza de cero.
          if (!isOrderOpen(d.order)) {
            // El pedido de mostrador no tiene mesa: se recordó bajo "mostrador", así que
            // se olvida con la misma clave. Sin esto, quedaría colgado en el celular.
            forgetOrder(d.restaurantSlug, d.order.table_code ?? "mostrador");
          }
        }
      } catch {
        if (alive) setError(t.common.offline);
      }
    }
    load();
    const timer = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // El diccionario solo alimenta los mensajes de error: no hay que reiniciar el
    // sondeo cada vez que alguien cambia de idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Aviso nivel 1: cuando el pedido pasa a "listo", la propia página avisa —vibra,
  // suena y cambia el título de la pestaña— sin push ni permisos. Cubre al cliente que
  // dejó la página abierta, que son casi todos. Se dispara una vez, al cruzar el estado.
  const status = data?.order.status;
  useEffect(() => {
    if (status !== "ready") return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Sin vibración (escritorio): el título y el banner siguen avisando.
    }
    const tituloPrevio = document.title;
    document.title = t.track.readyTab;
    let ctx: AudioContext | undefined;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch {
      // El navegador puede bloquear el audio sin un gesto previo: no pasa nada, es extra.
    }
    return () => {
      document.title = tituloPrevio;
      ctx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, t.track.readyTab]);

  // La captura se reduce EN EL CELULAR antes de subir: una foto de pantalla puede
  // pesar varios MB, y a la base solo debe llegar lo justo para que la caja la lea.
  // Se encoge a 900 px de lado mayor y se recomprime en JPEG. Si algo falla, se sube
  // la original: mejor una imagen grande que ninguna.
  async function elegirCaptura(file: File) {
    setReadingProof(true);
    try {
      const reducida = await reducirImagen(file, 900, 0.7);
      setProof(reducida);
    } catch {
      setProof(null);
    } finally {
      setReadingProof(false);
    }
  }

  async function claimPayment() {
    if (claiming || readingProof || !data) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimPayment: true, ...(proof ? { proof } : {}) }),
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
        {t.track.loading}
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
              {fmt(t.track.orderNo, { n: order.daily_number })}
              {order.table_label
                ? ` · ${order.table_label}`
                : order.customer_name
                  ? ` · ${order.customer_name}`
                  : ""}
            </p>
          </div>
          <div className="ml-auto">
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
        </header>

        {order.status === "ready" && !cancelled && (
          <div
            className="mt-5 flex items-center gap-3 p-4"
            style={{
              background: "var(--brand)",
              color: "var(--brand-contrast)",
              borderRadius: 18,
              animation: "pop .35s ease both",
            }}
          >
            <span className="text-2xl" aria-hidden>
              🔔
            </span>
            <span className="text-[16px] font-extrabold">{t.track.readyTitle}</span>
          </div>
        )}

        {/* Estado actual + línea de tiempo */}
        <section className="mt-5 p-[22px]" style={CARD}>
          <p
            className="text-[13px] font-extrabold uppercase tracking-[0.1em]"
            style={{ color: "var(--text-faint)" }}
          >
            {t.track.currentStatus}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ background: tone.color, boxShadow: `0 0 0 5px ${tone.soft}` }}
            />
            <h2 className="text-[26px] font-extrabold leading-none" style={{ color: "var(--text)" }}>
              {t.status[order.status]}
            </h2>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {t.hint[order.status]}
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
                        {t.status[status]}
                      </p>
                      {active && !last && (
                        <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                          {t.track.inProgress}
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
                {t.track.demoWarn}
              </p>
            )}
            <h3 className="text-[19px] font-extrabold" style={{ color: "var(--text)" }}>
              {fmt(t.track.payWith, { m: payLabel(t, method) })}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {payment.qr ? t.track.payScanPre : t.track.payPre}
              <strong style={{ color: "var(--text)" }}>
                {formatMoney(order.total_cents, currency)}
              </strong>
              {t.track.payPost}
            </p>
            {payment.qr && (
              <div className="my-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={payment.qr}
                  alt={fmt(t.track.qrAlt, { m: payLabel(t, method) })}
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
                {t.track.holder}{" "}
                <strong style={{ color: "var(--text)" }}>{data.restaurantName}</strong> ·{" "}
                <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                  {payNumber}
                </strong>
              </p>
            )}
            {/* Subir la captura del Yape/Plin. El comensal muestra el comprobante al
                vendedor; aquí lo deja en el sistema para que la caja lo compruebe.
                Es opcional: sin captura, el aviso igual llega. */}
            <label
              className="mt-4 flex cursor-pointer items-center gap-3 p-3.5 transition active:scale-[0.99]"
              style={{
                borderRadius: 15,
                border: `1.5px dashed ${proof ? "var(--success)" : "var(--border)"}`,
                background: proof ? "var(--success-soft)" : "var(--surface-2)",
              }}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) elegirCaptura(f);
                  e.target.value = "";
                }}
              />
              <span className="text-[26px] leading-none">{proof ? "✓" : "📸"}</span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[14px] font-extrabold"
                  style={{ color: proof ? "var(--success)" : "var(--text)" }}
                >
                  {readingProof
                    ? t.track.payProofReading
                    : proof
                      ? t.track.payProofReady
                      : t.track.payProofPrompt}
                </span>
                <span className="block text-[12px]" style={{ color: "var(--text-faint)" }}>
                  {proof ? t.track.payProofChange : t.track.payProofHint}
                </span>
              </span>
              {proof && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proof}
                  alt=""
                  className="h-12 w-12 shrink-0 object-cover"
                  style={{ borderRadius: 10, border: "1px solid var(--border-2)" }}
                />
              )}
            </label>

            <button
              onClick={claimPayment}
              disabled={claiming || readingProof}
              className="mt-3 w-full p-[15px] text-[15px] font-extrabold transition active:scale-[0.98] disabled:opacity-60"
              style={{
                borderRadius: 15,
                background: "var(--brand)",
                color: "var(--brand-contrast)",
              }}
            >
              {claiming ? t.track.claiming : t.track.iPaid}
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
              {t.track.claimedTitle}
            </h3>
            <p
              className="mx-auto mt-1.5 max-w-[30ch] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {t.track.claimedPre}
              <strong style={{ color: "var(--success)" }}>{t.track.paidWord}</strong>
              {t.track.claimedPost}
            </p>
            <span
              className="mt-3.5 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-extrabold"
              style={{
                borderRadius: 999,
                background: "var(--warning-soft)",
                color: "var(--warning)",
              }}
            >
              {t.track.waitingCaja}
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
            {fmt(t.track.paidWith, { m: payLabel(t, order.payment_method) })}
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
                {method
                  ? fmt(t.track.payAtVenueWith, { m: payLabel(t, method) })
                  : t.track.payAtVenue}
              </p>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                {fmt(t.track.chargedAtTable, {
                  amount: formatMoney(order.total_cents, currency),
                })}
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
            {t.menu.yourOrder}
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
            <span>{t.track.total}</span>
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
          {t.track.orderMore}
        </Link>

        <p className="mt-4 text-center text-xs" style={{ color: "var(--text-faint)" }}>
          {t.track.autoRefresh}
        </p>
      </div>
    </div>
  );
}
