"use client";

import { use, useEffect, useRef, useState } from "react";
import StaffGate from "@/app/components/StaffGate";
import { useKeepAwake } from "@/lib/keep-awake";
import type { OrderStatus, OrderWithDetails } from "@/lib/types";

// Columnas del tablero. El color es semántico (no de marca): significa lo mismo
// en cualquier restaurante.
const COLUMNS: {
  status: OrderStatus;
  label: string;
  color: string;
  soft: string;
  next: OrderStatus;
  nextLabel: string;
}[] = [
  {
    status: "pending",
    label: "Recibido",
    color: "#2563eb",
    soft: "#e8eefb",
    next: "preparing",
    nextLabel: "Empezar a preparar",
  },
  {
    status: "preparing",
    label: "En preparación",
    color: "#b45309",
    soft: "#fbf0dd",
    next: "ready",
    nextLabel: "Marcar listo",
  },
  {
    status: "ready",
    label: "Listo",
    color: "#15803d",
    soft: "#e7f3ec",
    next: "delivered",
    nextLabel: "Entregar",
  },
];

function minutesSince(createdAt: string): number {
  const d = new Date(createdAt.replace(" ", "T") + "Z");
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

// El tiempo transcurrido entra en alerta a los 6 min y en urgencia a los 10.
function elapsedTone(mins: number): { color: string; bg: string } {
  if (mins >= 10) return { color: "#b91c1c", bg: "#fbe7e4" };
  if (mins >= 6) return { color: "#b45309", bg: "#fbf0dd" };
  return { color: "#6b6258", bg: "#f0ede7" };
}

function KitchenBoard({ slug }: { slug: string }) {
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
    setOrders((os) =>
      status === "delivered" || status === "cancelled"
        ? os.filter((o) => o.id !== id)
        : os.map((o) => (o.id === id ? { ...o, status } : o))
    );
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

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
        <h1 className="text-[19px] font-extrabold">Cocina · {slug}</h1>
        <div className="ml-auto flex items-center gap-2">
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
            {soundOn ? "🔔 Sonido activo" : "🔕 Activar sonido"}
          </button>
          <span
            className="px-3 py-1.5 text-xs font-extrabold"
            style={{
              borderRadius: 999,
              background: connected ? "#173a25" : "#3d1f1c",
              color: connected ? "#6ee7a5" : "#fca5a5",
            }}
          >
            {connected ? "● En vivo" : "○ Sin conexión"}
          </span>
        </div>
      </header>

      <main className="grid flex-1 gap-4 p-[18px] lg:grid-cols-3">
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
                  {col.label}
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
                  Sin comandas
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
                        ⏱ {mins} min
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
                        {col.nextLabel} ▸
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
                          Anular
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
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
    <StaffGate slug={slug} title="Cocina">
      <KitchenBoard slug={slug} />
    </StaffGate>
  );
}
