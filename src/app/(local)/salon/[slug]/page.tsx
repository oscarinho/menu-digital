"use client";

import { use, useEffect, useState } from "react";
import StaffGate from "@/components/StaffGate";
import StaffShell, { type Marca } from "@/components/StaffShell";
import { IconCheck, IconReloj } from "@/components/icons";
import { fmt, useT } from "@/lib/i18n";
import { useKeepAwake } from "@/lib/keep-awake";
import { formatMoney } from "@/lib/money";
import type { OrderWithDetails, Table } from "@/lib/types";

// El plano del local.
//
// Se lee de un vistazo o no sirve para nada: el mozo cruza el salón mirando la tablet
// de reojo. Por eso la mesa con algo que hacer se tiñe entera de su color y la libre
// se apaga hasta casi desaparecer. De lejos, el salón es un mapa de manchas: donde hay
// color, hay trabajo.
//
// El estado se deduce de los pedidos; solo hay una cosa que la app no puede deducir y
// que por eso se le pide a una persona: que el comensal se fue. Pagar no vacía la mesa
// —siguen ahí, con el café—, y un pedido nuevo tampoco lo prueba: pueden ser los
// mismos pidiendo postre. Así que la cuenta pagada deja la mesa en "Cuenta cerrada"
// hasta que quien la recoge toca "Liberar".
//
// El color de cada estado es el mismo en los tres idiomas —el rojo de "por cobrar" no
// se traduce—; el nombre sale del diccionario, porque el mozo puede no leer español.
type StateKey = "free" | "closed" | "pending" | "preparing" | "ready" | "claimed" | "tocharge";

const TONE: Record<StateKey, { color: string; soft: string }> = {
  free: { color: "#8a8078", soft: "transparent" },
  closed: { color: "#57534e", soft: "#eeece9" },
  pending: { color: "#2563eb", soft: "#e8eefb" },
  preparing: { color: "#b45309", soft: "#fbf0dd" },
  ready: { color: "#15803d", soft: "#e7f3ec" },
  claimed: { color: "#0369a1", soft: "#e0f2fe" },
  tocharge: { color: "#b91c1c", soft: "#fbe7e4" },
};

function stateOf(order: OrderWithDetails | undefined): StateKey {
  if (!order) return "free";
  // Ya comió: lo único que le queda a la mesa es pagar.
  if (order.status === "delivered") {
    return order.payment_status === "claimed" ? "claimed" : "tocharge";
  }
  if (order.status === "pending" || order.status === "preparing" || order.status === "ready") {
    return order.status;
  }
  return "free";
}

function minutesSince(ts: string): number {
  const d = new Date(ts.replace(" ", "T") + "Z");
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function hourOf(ts: string): string {
  return new Date(ts.replace(" ", "T") + "Z").toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mesa 2 va antes que Mesa 10: ordenarlas por texto pondría la 10 en medio.
function byCode(a: Table, b: Table): number {
  const na = Number(a.code);
  const nb = Number(b.code);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.code.localeCompare(b.code);
}

function SalonBoard({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("salon");
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [restaurant, setRestaurant] = useState<Marca | null>(null);
  const [currency, setCurrency] = useState("PEN");
  const [freeing, setFreeing] = useState<string | null>(null);

  useKeepAwake();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders?slug=${slug}&view=salon`, { cache: "no-store" });
        const d = await res.json();
        if (alive && res.ok) {
          setTables(d.tables ?? []);
          setOrders(d.orders);
          setRestaurant(d.restaurant ?? null);
          setCurrency(d.currency);
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

  async function freeTable(tableId: string) {
    setFreeing(tableId);
    await fetch("/api/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantSlug: slug, tableId }),
    });
    // La marca la pone el servidor; la pintamos ya para que el toque se note, y en el
    // siguiente refresco (4s) llega la de verdad.
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    setTables((ts) => ts.map((x) => (x.id === tableId ? { ...x, freed_at: now } : x)));
    setFreeing(null);
  }

  const rows = [...tables].sort(byCode).map((table) => {
    const own = orders.filter((o) => o.table_id === table.id);

    // Vivos: la ocupan y hay algo que hacer con ellos. Una mesa puede tener más de uno
    // (pidió, y a media comida volvió a pedir): manda el último para el estado, pero la
    // cuenta los suma todos.
    const live = own
      .filter((o) => !(o.status === "delivered" && o.payment_status === "paid"))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Cerrados hoy: ya pagaron. La mesa NO queda libre por eso —siguen sentados—, queda
    // "cuenta cerrada" hasta que alguien la recoja. Y solo cuenta si se cerró DESPUÉS de
    // la última vez que se recogió: si no, la mesa ya está limpia.
    const closedAt = own
      .filter((o) => o.status === "delivered" && o.payment_status === "paid")
      .map((o) => o.updated_at)
      .sort()
      .pop();
    const pending = closedAt && closedAt > table.freed_at ? closedAt : undefined;

    return {
      table,
      order: live[0] as OrderWithDetails | undefined,
      extra: live.length - 1,
      total: live.reduce((s, o) => s + o.total_cents, 0),
      closedAt: live.length === 0 ? pending : undefined,
      state: (live.length > 0 ? stateOf(live[0]) : pending ? "closed" : "free") as StateKey,
    };
  });

  // "Ocupada" es cualquier mesa con gente: la que está pidiendo y la que ya pagó pero
  // nadie ha recogido.
  const busy = rows.filter((r) => r.order || r.closedAt).length;
  const unpaid = rows.reduce((s, r) => s + r.total, 0);

  return (
    <StaffShell
      slug={slug}
      surface="salon"
      restaurant={restaurant}
      t={t}
      lang={lang}
      onLang={setLang}
    >
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {/* El pulso del salón: cuántas mesas ocupadas y cuánto dinero hay sentado sin
            cobrar ahora mismo. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
            {fmt(busy === 1 ? t.salon.occupied1 : t.salon.occupiedN, { n: busy })}
            <span className="font-semibold" style={{ color: "var(--text-faint)" }}>
              {" · "}
              {fmt(rows.length - busy === 1 ? t.salon.free1 : t.salon.freeN, {
                n: rows.length - busy,
              })}
            </span>
          </p>
          {unpaid > 0 && (
            <span
              className="px-3.5 py-1.5 text-[13px] font-extrabold tabular-nums"
              style={{
                borderRadius: 999,
                background: "var(--warning-soft)",
                color: "var(--warning)",
              }}
            >
              {fmt(t.salon.unpaid, { amount: formatMoney(unpaid, currency) })}
            </span>
          )}
        </div>

        {rows.length === 0 && (
          <p className="mt-8 py-16 text-center font-semibold" style={{ color: "var(--text-faint)" }}>
            {t.salon.noTables}
          </p>
        )}

        <div
          className="mt-5 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}
        >
          {rows.map(({ table, order, extra, total, closedAt, state }) => {
            const viva = Boolean(order || closedAt);
            const tone = TONE[state];
            return (
              <article
                key={table.id}
                className="flex flex-col gap-2 p-4"
                style={{
                  background: viva ? tone.soft : "var(--surface)",
                  border: `1px solid ${viva ? tone.color + "40" : "var(--border-2)"}`,
                  borderRadius: 16,
                  minHeight: 132,
                  opacity: viva ? 1 : 0.6,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: tone.color }}
                  />
                  <p
                    className="text-[18px] font-extrabold leading-tight"
                    style={{
                      color: "var(--text)",
                      fontFamily: "var(--font-display), system-ui, sans-serif",
                    }}
                  >
                    {table.label}
                  </p>
                  {order && (
                    <span
                      className="ml-auto text-[12px] font-extrabold tabular-nums"
                      style={{ color: tone.color }}
                    >
                      #{order.daily_number}
                    </span>
                  )}
                </div>

                <p
                  className="text-[12.5px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: tone.color }}
                >
                  {t.salon[state]}
                </p>

                {order && (
                  <>
                    <p
                      className="mt-auto flex items-center gap-1 text-[12px] font-semibold tabular-nums"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <IconReloj size={13} />
                      {minutesSince(order.created_at)} {t.common.min}
                      {extra > 0 &&
                        ` · ${fmt(extra === 1 ? t.salon.extra1 : t.salon.extraN, { n: extra })}`}
                    </p>
                    <p
                      className="text-[19px] font-extrabold leading-none tabular-nums"
                      style={{
                        color: "var(--text)",
                        fontFamily: "var(--font-display), system-ui, sans-serif",
                      }}
                    >
                      {formatMoney(total, currency)}
                    </p>
                  </>
                )}

                {closedAt && (
                  <>
                    <p
                      className="mt-auto flex items-center gap-1 text-[12px] font-semibold tabular-nums"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <IconCheck size={13} />
                      {fmt(t.salon.paidAt, { h: hourOf(closedAt) })}
                    </p>
                    {/* El único dato que le pedimos a una persona, porque es el único
                        que la app no puede deducir: que la mesa se recogió. */}
                    <button
                      onClick={() => freeTable(table.id)}
                      disabled={freeing === table.id}
                      className="py-3 text-[13.5px] font-extrabold transition active:scale-[0.96] disabled:opacity-50"
                      style={{
                        borderRadius: 12,
                        background: "var(--brand)",
                        color: "var(--brand-contrast)",
                      }}
                    >
                      {freeing === table.id ? t.salon.freeing : t.salon.freeTable}
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </StaffShell>
  );
}

export default function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} surface="salon">
      <SalonBoard slug={slug} />
    </StaffGate>
  );
}
