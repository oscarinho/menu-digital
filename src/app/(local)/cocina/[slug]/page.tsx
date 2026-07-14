"use client";

import { use, useEffect, useRef, useState } from "react";
import StaffGate from "@/components/StaffGate";
import StaffShell, { type Marca } from "@/components/StaffShell";
import {
  IconCheck,
  IconEquis,
  IconFlecha,
  IconNota,
  IconReloj,
  IconSonido,
  IconVolver,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import type { OrderStatus, OrderWithDetails } from "@/lib/types";

// El tablero del pase.
//
// Esta pantalla se mira dos segundos, desde tres metros y con las manos ocupadas.
// Todo lo de aquí sale de ahí: fondo oscuro para que la comanda blanca salte, el
// número de mesa como lo más grande de la tarjeta, la cantidad en su propia caja y
// antes del plato —primero cuántos, que es lo que hay que contar— y un solo botón
// grande para avanzar. Nada que exija leer con calma.
//
// El color de cada columna es semántico, no de marca: significa lo mismo en
// cualquier restaurante. Los nombres salen del diccionario, porque el cocinero puede
// no leer español.
type Step = "pending" | "preparing" | "ready";

const COLUMNS: { status: Step; color: string; next: OrderStatus }[] = [
  { status: "pending", color: "#3b82f6", next: "preparing" },
  { status: "preparing", color: "#f59e0b", next: "ready" },
  { status: "ready", color: "#22c55e", next: "delivered" },
];

// Cuarta columna: no es un paso más del flujo (no tiene botón "siguiente"), es la
// memoria del turno. Por eso va fuera de COLUMNS.
const DONE_COLOR = "#8a8078";

// Las fechas llegan de SQLite como 'YYYY-MM-DD HH:MM:SS' en UTC.
function parseTs(ts: string): Date {
  return new Date(ts.replace(" ", "T") + "Z");
}

function minutesSince(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - parseTs(createdAt).getTime()) / 60000));
}

function hourOf(ts: string): string {
  return parseTs(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// A los 6 minutos el plato empieza a llegar tarde; a los 10, ya lo es.
function elapsedTone(mins: number): { color: string; bg: string } {
  if (mins >= 10) return { color: "#fca5a5", bg: "#3d1f1c" };
  if (mins >= 6) return { color: "#fcd34d", bg: "#3a2f16" };
  return { color: "#a99e8e", bg: "#2b241c" };
}

function KitchenBoard({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("cocina");
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [restaurant, setRestaurant] = useState<Marca | null>(null);
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
        const res = await fetch(`/api/orders?slug=${slug}&view=kitchen`, { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        if (res.ok) {
          setOrders(d.orders);
          setRestaurant(d.restaurant ?? null);
          setConnected(true);
        }
      } catch {
        if (alive) setConnected(false);
      }
    }
    load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
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

  const cabecera = (color: string, titulo: string, n: number) => (
    <div className="flex items-center gap-2.5 px-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <h2
        className="text-[13px] font-extrabold uppercase tracking-[0.09em]"
        style={{ color: "#e8e2d8" }}
      >
        {titulo}
      </h2>
      <span
        className="ml-auto flex h-6 min-w-[24px] items-center justify-center px-1.5 text-[13px] font-extrabold tabular-nums"
        style={{ borderRadius: 999, background: color, color: "#17130e" }}
      >
        {n}
      </span>
    </div>
  );

  const vacio = (texto: string) => (
    <p
      className="p-7 text-center text-[13px] font-bold"
      style={{ borderRadius: 16, border: "2px dashed #332c24", color: "#6e655a" }}
    >
      {texto}
    </p>
  );

  return (
    <StaffShell
      slug={slug}
      surface="cocina"
      restaurant={restaurant}
      t={t}
      lang={lang}
      onLang={setLang}
      tone="dark"
      connected={connected}
      actions={
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={soundOn ? t.kitchen.soundOn : t.kitchen.soundOff}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold"
          style={{
            borderRadius: 999,
            background: soundOn ? "#2b241c" : "transparent",
            border: "1px solid #332c24",
            color: soundOn ? "#f7f3ec" : "#a99e8e",
          }}
        >
          <IconSonido size={16} off={!soundOn} />
          <span className="hidden sm:inline">
            {soundOn ? t.kitchen.soundOn : t.kitchen.soundOff}
          </span>
        </button>
      }
    >
      <main className="grid flex-1 gap-4 p-4 sm:p-5 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="flex flex-col gap-3">
              {cabecera(col.color, t.kitchen.cols[col.status], colOrders.length)}

              {colOrders.length === 0 && vacio(t.kitchen.empty)}

              {colOrders.map((o) => {
                const mins = minutesSince(o.created_at);
                const tone = elapsedTone(mins);
                return (
                  <article
                    key={o.id}
                    className="overflow-hidden"
                    style={{
                      background: "#fffdf9",
                      borderRadius: 16,
                      boxShadow: "0 12px 28px -18px rgba(0,0,0,.75)",
                      animation: "reveal .2s ease both",
                    }}
                  >
                    {/* La franja de color dice en qué columna está: se reconoce sin
                        leer, que es como se mira esta pantalla. */}
                    <div style={{ height: 4, background: col.color }} />

                    <div className="flex items-center gap-2.5 px-4 pt-3.5">
                      <span
                        className="text-[26px] font-extrabold leading-none tracking-tight"
                        style={{
                          color: "var(--text)",
                          fontFamily: "var(--font-display), system-ui, sans-serif",
                        }}
                      >
                        {o.table_label}
                      </span>
                      <span
                        className="text-[13px] font-extrabold tabular-nums"
                        style={{ color: "var(--text-faint)" }}
                      >
                        #{o.daily_number}
                      </span>
                      <span
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[13px] font-extrabold tabular-nums"
                        style={{ borderRadius: 999, color: tone.color, background: tone.bg }}
                      >
                        <IconReloj size={14} />
                        {mins} {t.common.min}
                      </span>
                    </div>

                    <ul className="mt-3 flex flex-col gap-2 px-4">
                      {o.items.map((it) => (
                        <li key={it.id} className="flex items-start gap-2.5">
                          {/* La cantidad, en su propia caja: es lo primero que hay
                              que contar, no un número perdido delante del nombre. */}
                          <span
                            className="flex h-7 min-w-[28px] shrink-0 items-center justify-center px-1 text-[15px] font-extrabold tabular-nums"
                            style={{ borderRadius: 8, background: col.color, color: "#fff" }}
                          >
                            {it.quantity}
                          </span>
                          <span
                            className="pt-0.5 text-[16px] font-bold leading-snug"
                            style={{ color: "var(--text)" }}
                          >
                            {it.name}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {o.notes && (
                      <p
                        className="mx-4 mt-3 flex items-start gap-2 px-3 py-2 text-[13.5px] font-bold"
                        style={{
                          borderRadius: 10,
                          background: "var(--warning-soft)",
                          color: "#8a5a12",
                        }}
                      >
                        <IconNota size={16} className="mt-px shrink-0" />
                        {o.notes}
                      </p>
                    )}

                    <div className="mt-3.5 flex gap-2 px-4 pb-4">
                      <button
                        onClick={() => setStatus(o.id, col.next)}
                        className="flex flex-1 items-center justify-center gap-2 py-4 text-[15px] font-extrabold text-white transition active:scale-[0.97]"
                        style={{ borderRadius: 12, background: col.color }}
                      >
                        {t.kitchen.next[col.status]}
                        <IconFlecha size={17} />
                      </button>
                      {o.status === "pending" && (
                        <button
                          onClick={() => setStatus(o.id, "cancelled")}
                          title={t.kitchen.cancel}
                          aria-label={t.kitchen.cancel}
                          className="flex items-center justify-center px-4 transition active:scale-[0.96]"
                          style={{
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            color: "var(--text-faint)",
                          }}
                        >
                          <IconEquis size={18} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}

        {/* Entregados: lo que ya salió hoy, mesa por mesa. La cocina lo necesita para
            responder "¿esa mesa ya tiene su plato?" sin preguntarle a nadie. */}
        <section className="flex flex-col gap-3">
          {cabecera(DONE_COLOR, t.kitchen.done, delivered.length)}

          {delivered.length === 0 && vacio(t.kitchen.noneDone)}

          {delivered.map((o) => (
            <article
              key={o.id}
              className="px-4 py-3.5"
              style={{
                background: "#2b241c",
                border: "1px solid #332c24",
                borderRadius: 14,
                animation: "reveal .2s ease both",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[17px] font-extrabold leading-none"
                  style={{
                    color: "#e8e2d8",
                    fontFamily: "var(--font-display), system-ui, sans-serif",
                  }}
                >
                  {o.table_label}
                </span>
                <span
                  className="text-[12.5px] font-extrabold tabular-nums"
                  style={{ color: "#8a8078" }}
                >
                  #{o.daily_number}
                </span>
                <span
                  className="ml-auto flex items-center gap-1 text-[12.5px] font-extrabold tabular-nums"
                  style={{ color: "#6ee7a5" }}
                >
                  <IconCheck size={13} />
                  {hourOf(o.updated_at)}
                </span>
              </div>

              <p
                className="mt-1.5 text-[13px] font-semibold leading-snug"
                style={{ color: "#a99e8e" }}
              >
                {o.items.map((it) => `${it.quantity}× ${it.name}`).join(" · ")}
              </p>

              {/* Si se entregó por error, se puede volver. Es la única marcha atrás del
                  tablero, y por eso está discreta: no se toca sin querer. */}
              <button
                onClick={() => setStatus(o.id, "ready")}
                className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold"
                style={{ borderRadius: 9, border: "1px solid #3a332a", color: "#a99e8e" }}
              >
                <IconVolver size={13} />
                {t.kitchen.backToReady}
              </button>
            </article>
          ))}
        </section>
      </main>
    </StaffShell>
  );
}

export default function CocinaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} surface="cocina">
      <KitchenBoard slug={slug} />
    </StaffGate>
  );
}
