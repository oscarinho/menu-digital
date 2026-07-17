"use client";

import { use, useEffect, useState } from "react";
import StaffGate from "@/components/StaffGate";
import StaffShell, { type Marca } from "@/components/StaffShell";
import { IconCheck, IconEquis } from "@/components/icons";
import { fmt, payLabel, useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import { formatMoney } from "@/lib/money";
import { getPaymentMethods, isInAppMethod } from "@/lib/payments";
import type { OrderWithDetails } from "@/lib/types";

// La lista que se sondea no trae la captura (pesa); trae una bandera y la caja pide
// la imagen entera al abrir la cuenta. Ver /api/orders (GET).
type CajaOrder = Omit<OrderWithDetails, "payment_proof"> & { has_proof: boolean };

// Lo que la caja está escribiendo mientras comprueba un pago: método, N.º de
// operación, monto (en unidades, como lo teclea) y propina.
interface FormularioCobro {
  method: string;
  ref: string;
  amount: string;
  tip: string;
}

// "12.50" → 1250 céntimos. Vacío o basura → 0.
function aCentimos(txt: string): number {
  const n = Math.round(parseFloat(txt.replace(",", ".")) * 100);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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
  const [orders, setOrders] = useState<CajaOrder[]>([]);
  const [restaurant, setRestaurant] = useState<Marca | null>(null);
  const [currency, setCurrency] = useState("PEN");
  const [country, setCountry] = useState("PE");
  const [charging, setCharging] = useState<string | null>(null);
  // El formulario de comprobación de la cuenta que está abierta ahora mismo, y la
  // captura del cliente (cargada aparte, bajo demanda). Solo hay una cuenta abierta
  // a la vez, así que con un único formulario alcanza.
  const [form, setForm] = useState<FormularioCobro | null>(null);
  const [proofImg, setProofImg] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

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

  const ahora = () => new Date().toISOString().slice(0, 19).replace("T", " ");

  // Abrir la comprobación de una cuenta: prepara el formulario (método sugerido, monto
  // = total) y, si el cliente subió captura, la pide aparte —la lista no la trae.
  function abrirCobro(o: CajaOrder) {
    setCharging(o.id);
    setProofImg(null);
    setForm({
      method: o.payment_method || methods[0]?.id || "cash",
      ref: "",
      amount: (o.total_cents / 100).toFixed(2),
      tip: "",
    });
    if (o.has_proof) {
      setProofLoading(true);
      fetch(`/api/orders/${o.id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setProofImg(d.order?.payment_proof || null))
        .catch(() => {})
        .finally(() => setProofLoading(false));
    }
  }

  function cerrarCobro() {
    setCharging(null);
    setForm(null);
    setProofImg(null);
  }

  // Confirmar el cobro con todo lo que anotó la caja. El monto por defecto es el
  // total; si el cajero lo dejó igual, no se manda y el servidor usa el total.
  async function confirmarCobro(orderId: string) {
    if (!form) return;
    const amountCents = aCentimos(form.amount);
    const tipCents = aCentimos(form.tip);
    const ref = form.ref.trim();
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payment_status: "paid" as const,
              payment_method: form.method,
              payment_ref: ref,
              paid_amount_cents: amountCents || o.total_cents,
              tip_cents: tipCents,
              updated_at: ahora(),
            }
          : o
      )
    );
    cerrarCobro();
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: form.method,
        paymentRef: ref,
        amountCents,
        tipCents,
      }),
    });
  }

  // Cambiar solo el método de un cobro ya cerrado (sin tocar operación/monto/propina).
  async function swapMethod(orderId: string, method: string) {
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId ? { ...o, payment_method: method, updated_at: ahora() } : o
      )
    );
    setCharging(null);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeMethod: true, paymentMethod: method }),
    });
  }

  // Deshacer un cobro puesto por error: el pedido vuelve arriba, a cuentas abiertas.
  // No borra plata: solo dice "todavía no pagó", que es lo que la caja necesita para
  // volver a cobrarlo bien.
  async function revertPaid(orderId: string) {
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payment_status: "unpaid" as const,
              updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
            }
          : o
      )
    );
    setCharging(null);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revertPayment: true }),
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

                  <button
                    onClick={() => (eligiendo ? cerrarCobro() : abrirCobro(o))}
                    className="flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold transition active:scale-[0.96]"
                    style={{
                      borderRadius: 13,
                      background: eligiendo
                        ? "var(--neutral-soft)"
                        : claimed
                          ? "var(--success)"
                          : "var(--brand)",
                      color: eligiendo ? "var(--text)" : claimed ? "#fff" : "var(--brand-contrast)",
                    }}
                  >
                    {eligiendo ? (
                      <IconEquis size={16} />
                    ) : claimed ? (
                      <IconCheck size={17} />
                    ) : null}
                    {eligiendo ? t.caja.cancel : claimed ? t.caja.confirm : t.caja.charge}
                  </button>
                </div>

                {/* Comprobar el pago: la captura del cliente, el método, y lo que la
                    caja anota —N.º de operación, monto y propina— antes de dar por
                    cobrada la cuenta. Todo opcional salvo el método: un pago en
                    efectivo no tiene operación que anotar. */}
                {eligiendo && form && (
                  <div
                    className="flex flex-col gap-3 px-4 pb-4 sm:px-5"
                    style={{ animation: "reveal .18s ease both" }}
                  >
                    {(o.has_proof || proofLoading) && (
                      <div>
                        <p
                          className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {t.caja.proofTitle}
                        </p>
                        {proofLoading ? (
                          <div
                            className="h-40 w-full animate-pulse"
                            style={{ borderRadius: 12, background: "var(--neutral-soft)" }}
                          />
                        ) : proofImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={proofImg}
                            alt={t.caja.proofTitle}
                            className="max-h-72 w-auto object-contain"
                            style={{ borderRadius: 12, border: "1px solid var(--border-2)" }}
                          />
                        ) : null}
                      </div>
                    )}
                    {claimed && !o.has_proof && (
                      <p className="text-[12.5px] font-semibold" style={{ color: "var(--warning)" }}>
                        {t.caja.noProof}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {methods.map((m) => {
                        const on = form.method === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setForm((f) => (f ? { ...f, method: m.id } : f))}
                            className="flex-1 px-4 py-3 text-sm font-extrabold transition active:scale-[0.96]"
                            style={{
                              borderRadius: 13,
                              border: `1.5px solid ${on ? "var(--brand)" : "var(--border)"}`,
                              background: "var(--surface-2)",
                              color: "var(--text)",
                            }}
                          >
                            {m.icon} {payLabel(t, m.id)}
                          </button>
                        );
                      })}
                    </div>

                    {/* El N.º de operación solo tiene sentido en pago digital; en
                        efectivo se oculta para no pedir lo que no existe. */}
                    <div className="flex flex-wrap gap-2">
                      {isInAppMethod(form.method) && (
                        <label
                          className="min-w-[46%] flex-1 text-[12px] font-bold"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {t.caja.opNumber}
                          <input
                            value={form.ref}
                            onChange={(e) => setForm((f) => (f ? { ...f, ref: e.target.value } : f))}
                            inputMode="numeric"
                            placeholder={t.caja.opNumberPh}
                            className="mt-1 w-full px-3 py-2.5 text-[15px] font-bold tabular-nums"
                            style={{
                              borderRadius: 11,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color: "var(--text)",
                            }}
                          />
                        </label>
                      )}
                      <label
                        className="min-w-[46%] flex-1 text-[12px] font-bold"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {t.caja.amountReceived}
                        <input
                          value={form.amount}
                          onChange={(e) => setForm((f) => (f ? { ...f, amount: e.target.value } : f))}
                          inputMode="decimal"
                          className="mt-1 w-full px-3 py-2.5 text-[15px] font-bold tabular-nums"
                          style={{
                            borderRadius: 11,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                      <label
                        className="min-w-[46%] flex-1 text-[12px] font-bold"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {t.caja.tip}
                        <input
                          value={form.tip}
                          onChange={(e) => setForm((f) => (f ? { ...f, tip: e.target.value } : f))}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="mt-1 w-full px-3 py-2.5 text-[15px] font-bold tabular-nums"
                          style={{
                            borderRadius: 11,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text)",
                          }}
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => confirmarCobro(o.id)}
                      className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-extrabold text-white transition active:scale-[0.97]"
                      style={{ borderRadius: 13, background: "var(--success)" }}
                    >
                      <IconCheck size={17} /> {t.caja.confirm}
                    </button>
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
              {paid.map((o, i) => {
                const eligiendo = charging === o.id;
                return (
                  <div
                    key={o.id}
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-2)" }}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5">
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

                    {/* Corregir un cobro ya cerrado: cambiar con qué se pagó, o
                        deshacerlo del todo si se marcó por error. Discreto —van en gris,
                        no compiten con los botones grandes de cobrar de arriba. */}
                    <div className="flex flex-wrap gap-2 px-5 pb-3">
                      <button
                        onClick={() => setCharging(eligiendo ? null : o.id)}
                        className="px-3 py-1.5 text-[12.5px] font-bold transition active:scale-[0.96]"
                        style={{
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: eligiendo ? "var(--neutral-soft)" : "transparent",
                          color: "var(--text-faint)",
                        }}
                      >
                        {eligiendo ? t.caja.cancel : t.caja.changeMethod}
                      </button>
                      <button
                        onClick={() => revertPaid(o.id)}
                        className="px-3 py-1.5 text-[12.5px] font-bold transition active:scale-[0.96]"
                        style={{
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--danger, var(--warning))",
                        }}
                      >
                        {t.caja.revert}
                      </button>
                    </div>

                    {eligiendo && (
                      <div
                        className="flex flex-wrap gap-2 px-5 pb-4"
                        style={{ animation: "reveal .18s ease both" }}
                      >
                        {methods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => swapMethod(o.id, m.id)}
                            className="flex-1 px-4 py-3 text-sm font-extrabold transition active:scale-[0.96]"
                            style={{
                              borderRadius: 13,
                              border: `1px solid ${o.payment_method === m.id ? "var(--brand)" : "var(--border)"}`,
                              background: "var(--surface-2)",
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
