"use client";

import { use, useEffect, useRef, useState } from "react";
import LangSwitch from "@/components/LangSwitch";
import StaffGate from "@/components/StaffGate";
import { useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import type { OrderStatus, OrderWithDetails } from "@/lib/types";

// Columnas del tablero. El color es semántico (no de marca): significa lo mismo en
// cualquier restaurante. Los nombres, en cambio, salen del diccionario: la tablet del
// pase la mira un cocinero que puede no leer español —de ahí salió este cambio.
type Step = "pending" | "preparing" | "ready";

const COLUMNS: { status: Step; color: string; soft: string; next: OrderStatus }[] = [
  { status: "pending", color: "#2563eb", soft: "#e8eefb", next: "preparing" },
  { status: "preparing", color: "#b45309", soft: "#fbf0dd", next: "ready" },
  { status: "ready", color: "#15803d", soft: "#e7f3ec", next: "delivered" },
];

// Las fechas llegan de SQLite como 'YYYY-MM-DD HH:MM:SS' en UTC.
function parseTs(ts: string): Date {
  return new Date(ts.replace(" ", "T") + "Z");
}

// Cuarta columna: no es un paso más del flujo (no tiene botón "siguiente"), es la
// memoria del turno. Por eso va fuera de COLUMNS.
const DONE = { color: "#57534e", soft: "#e7e5e4" };

function minutesSince(createdAt: string): number {
  const d = parseTs(createdAt);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function hourOf(ts: string): string {
  return parseTs(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// El tiempo transcurrido entra en alerta a los 6 min y en urgencia a los 10.
function elapsedTone(mins: number): { color: string; bg: string } {
  if (mins >= 10) return { color: "#b91c1c", bg: "#fbe7e4" };
  if (mins >= 6) return { color: "#b45309", bg: "#fbf0dd" };
  return { color: "#6b6258", bg: "#f0ede7" };
}

function KitchenBoard({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("cocina");
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [connected, setConnected] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useKeepAwake();

  function beep() {
    const ctx = audioCtx.current;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  }

  function toggleSound() {
    if (!soundOn) {
      audioCtx.current ??= new AudioContext();
      audioCtx.current.resume();
      setSoundOn(true);
    } else {
      setSoundOn(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders?slug=${slug}&view=kitchen`, {
          cache: "no-store",
        });
        const d = await res.json();
        if (!alive) return;
        if (res.ok) {
          setOrders(d.orders);
          setConnected(true);
        }
      } catch {
        if (alive) setConnected(false);
      }
    }
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug]);

  // Campanilla cuando aparece un pedido que no habíamos visto.
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (knownIds.current !== null) {
      const hasNew = orders.some((o) => !knownIds.current!.has(o.id));
      if (hasNew && soundOn) beep();
    }
    knownIds.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function setStatus(id: string, status: OrderStatus) {
    // El entregado no se va del tablero: baja a la columna "Entregados" y ahí se
    // queda hasta el cierre del día. El anulado sí desaparece, no hay nada que ver.
    setOrders((os) =>
      status === "cancelled"
        ? os.filter((o) => o.id !== id)
        : os.map((o) =>
            o.id === id
              ? { ...o, status, updated_at: new Date().toISOString().slice(0, 19).replace("T", " ") }
              : o
          )
    );
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  // El último entregado, arriba: es el que la mesa acaba de recibir y por el que van
  // a preguntar.
  const delivered = orders
    .filter((o) => o.status === "delivered")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="flex flex-1 flex-col" style={{ background: "#211d18" }}>
      <header
        className="flex items-center gap-3.5 px-[22px] py-4"
        style={{ background: "#17130e", color: "#f7f3ec" }}
      >
        <span
          className="flex h-[34px] w-[34px] items-center justify-center text-lg"
          style={{ borderRadius: 9, background: "var(--brand)" }}
          aria-hidden
        >
          🍳
        </span>
        <h1 className="text-[19px] font-extrabold">
          {t.nav.cocina} · {slug}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch lang={lang} onChange={setLang} tone="dark" />
          <button
            onClick={toggleSound}
            className="px-3 py-1.5 text-xs font-extrabold"
            style={{
              borderRadius: 999,
              background: soundOn ? "#3a332a" : "transparent",
              border: "1px solid #3a332a",
              color: soundOn ? "#f7f3ec" : "#b7ae9f",
            }}
          >
            {soundOn ? t.kitchen.soundOn : t.kitchen.soundOff}
          </button>
          <span
            className="px-3 py-1.5 text-xs font-extrabold"
            style={{
              borderRadius: 999,
              background: connected ? "#173a25" : "#3d1f1c",
              color: connected ? "#6ee7a5" : "#fca5a5",
            }}
          >
            {connected ? t.kitchen.live : `○ ${t.common.offline}`}
          </span>
        </div>
      </header>

      <main className="grid flex-1 gap-4 p-[18px] lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 px-1 pt-0.5">
                <span
                  className="h-[11px] w-[11px] rounded-full"
                  style={{ background: col.color }}
                />
                <h2
                  className="text-[15px] font-extrabold uppercase tracking-[0.05em]"
                  style={{ color: "#f7f3ec" }}
                >
                  {t.kitchen.cols[col.status]}
                </h2>
                <span
                  className="ml-auto px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums"
                  style={{ borderRadius: 999, background: col.soft, color: col.color }}
                >
                  {colOrders.length}
                </span>
              </div>

              {colOrders.length === 0 && (
                <p
                  className="p-[26px] text-center text-sm font-bold"
                  style={{
                    borderRadius: 16,
                    border: "2px dashed #3a332a",
                    color: "#6e655a",
                  }}
                >
                  {t.kitchen.empty}
                </p>
              )}

              {colOrders.map((o) => {
                const mins = minutesSince(o.created_at);
                const tone = elapsedTone(mins);
                return (
                  <article
                    key={o.id}
                    className="p-4"
                    style={{
                      background: "#ffffff",
                      borderRadius: 18,
                      borderLeft: `5px solid ${col.color}`,
                      boxShadow: "0 10px 24px -16px rgba(0,0,0,.6)",
                      animation: "reveal .2s ease both",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="text-[22px] font-extrabold leading-none"
                        style={{
                          color: "var(--text)",
                          fontFamily: "var(--font-display), system-ui, sans-serif",
                        }}
                      >
                        {o.table_label}
                      </span>
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: "var(--text-faint)" }}
                      >
                        #{o.daily_number}
                      </span>
                      <span
                        className="ml-auto px-2.5 py-1 text-[13px] font-extrabold tabular-nums"
                        style={{ borderRadius: 999, color: tone.color, background: tone.bg }}
                      >
                        ⏱ {mins} {t.common.min}
                      </span>
                    </div>

                    <ul className="mt-3 flex flex-col gap-[7px]">
                      {o.items.map((it) => (
                        <li key={it.id} className="flex items-baseline gap-2.5">
                          <span
                            className="min-w-[28px] text-lg font-extrabold"
                            style={{
                              color: col.color,
                              fontFamily: "var(--font-display), system-ui, sans-serif",
                            }}
                          >
                            {it.quantity}×
                          </span>
                          <span
                            className="text-base font-bold leading-tight"
                            style={{ color: "var(--text)" }}
                          >
                            {it.name}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {o.notes && (
                      <p
                        className="mt-3 px-3 py-2 text-[13.5px] font-bold"
                        style={{
                          borderRadius: 11,
                          background: "var(--warning-soft)",
                          color: "#8a5a12",
                        }}
                      >
                        📝 {o.notes}
                      </p>
                    )}

                    <div className="mt-3.5 flex gap-2">
                      <button
                        onClick={() => setStatus(o.id, col.next)}
                        className="flex-1 py-3.5 text-[15px] font-extrabold text-white transition active:scale-[0.97]"
                        style={{ borderRadius: 13, background: col.color }}
                      >
                        {t.kitchen.next[col.status]} ▸
                      </button>
                      {o.status === "pending" && (
                        <button
                          onClick={() => setStatus(o.id, "cancelled")}
                          className="px-4 py-3.5 text-sm font-bold"
                          style={{
                            borderRadius: 13,
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {t.kitchen.cancel}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}

        {/* Entregados: lo que ya salió hoy, mesa por mesa. Cocina lo necesita para
            responder "¿esa mesa ya tiene su plato?" sin preguntar a nadie. */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-1 pt-0.5">
            <span
              className="h-[11px] w-[11px] rounded-full"
              style={{ background: DONE.color }}
            />
            <h2
              className="text-[15px] font-extrabold uppercase tracking-[0.05em]"
              style={{ color: "#f7f3ec" }}
            >
              {t.kitchen.done}
            </h2>
            <span
              className="ml-auto px-2.5 py-0.5 text-[13px] font-extrabold tabular-nums"
              style={{ borderRadius: 999, background: DONE.soft, color: DONE.color }}
            >
              {delivered.length}
            </span>
          </div>

          {delivered.length === 0 && (
            <p
              className="p-[26px] text-center text-sm font-bold"
              style={{ borderRadius: 16, border: "2px dashed #3a332a", color: "#6e655a" }}
            >
              {t.kitchen.noneDone}
            </p>
          )}

          {delivered.map((o) => (
            <article
              key={o.id}
              className="p-3.5"
              style={{
                background: "#f7f3ec",
                borderRadius: 18,
                borderLeft: `5px solid ${DONE.color}`,
                animation: "reveal .2s ease both",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-lg font-extrabold leading-none"
                  style={{
                    color: "var(--text)",
                    fontFamily: "var(--font-display), system-ui, sans-serif",
                  }}
                >
                  {o.table_label}
                </span>
                <span
                  className="text-[13px] font-bold"
                  style={{ color: "var(--text-faint)" }}
                >
                  #{o.daily_number}
                </span>
                <span
                  className="ml-auto text-[12.5px] font-bold tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  ✓ {hourOf(o.updated_at)}
                </span>
              </div>

              <p
                className="mt-1.5 text-[13.5px] font-semibold leading-snug"
                style={{ color: "var(--text-muted)" }}
              >
                {o.items.map((it) => `${it.quantity}× ${it.name}`).join(" · ")}
              </p>

              <button
                onClick={() => setStatus(o.id, "ready")}
                className="mt-2.5 px-3 py-1.5 text-xs font-bold"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {t.kitchen.backToReady}
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default function CocinaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} surface="cocina">
      <KitchenBoard slug={slug} />
    </StaffGate>
  );
}
