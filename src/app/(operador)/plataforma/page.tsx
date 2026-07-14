"use client";

import { useCallback, useEffect, useState } from "react";
import { initialsOf } from "@/lib/brand";
import { formatMoney } from "@/lib/money";

interface PlatformRestaurant {
  id: string;
  slug: string;
  name: string;
  active: number;
  plan: string;
  monthly_fee_cents: number;
  staff_pin: string;
  created_at: string;
  table_count: number;
  item_count: number;
  orders_today: number;
  revenue_today_cents: number;
}

const GRID = "1.8fr 1fr .8fr .9fr 1.1fr";

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  boxShadow: "0 20px 40px -34px rgba(33,29,24,.35)",
};

const INPUT: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 11,
  color: "var(--text)",
};

const DISPLAY = "var(--font-display), system-ui, sans-serif";

// Color estable por slug: el mismo local siempre lleva la misma pastilla.
const TILE_COLORS = ["#0e6e86", "#d33a2c", "#1e9e5a", "#9a5b34", "#7c3aed", "#db2777"];
function tileColor(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TILE_COLORS[h % TILE_COLORS.length];
}

function Metric({
  label,
  value,
  dark,
}: {
  label: string;
  value: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className="p-5"
      style={dark ? { ...CARD, background: "#211d18", border: "none" } : CARD}
    >
      <p
        className="text-[13px] font-bold"
        style={{ color: dark ? "#b7ae9f" : "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[34px] font-extrabold leading-none"
        style={{ color: dark ? "#f0a28c" : "var(--text)", fontFamily: DISPLAY }}
      >
        {value}
      </p>
    </div>
  );
}

export default function PlataformaPage() {
  const [state, setState] = useState<"checking" | "login" | "ok">("checking");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [restaurants, setRestaurants] = useState<PlatformRestaurant[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", pin: "", fee: "99", tables: "6" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/restaurants", { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setRestaurants(d.restaurants);
      setState("ok");
    } else {
      setState("login");
    }
  }, []);

  useEffect(() => {
    // load() es asíncrona: el setState ocurre tras el await de fetch, no en el
    // cuerpo del efecto, así que no hay renders en cascada que evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/platform/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) load();
    else setError("Clave incorrecta");
  }

  async function createRestaurant(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/platform/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || form.name,
          staffPin: form.pin,
          monthlyFeeCents: Math.round(Number(form.fee.replace(",", ".")) * 100),
          tables: Number(form.tables),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo crear");
      setForm({ name: "", slug: "", pin: "", fee: "99", tables: "6" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(r: PlatformRestaurant) {
    await fetch("/api/platform/restaurants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
    load();
  }

  if (state === "checking") {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--text-faint)" }}
      >
        Cargando…
      </div>
    );
  }

  if (state === "login") {
    return (
      <div
        className="flex flex-1 items-center justify-center px-4"
        style={{ background: "var(--bg)" }}
      >
        <form
          onSubmit={login}
          className="w-full max-w-sm p-8 text-center"
          style={{ ...CARD, borderRadius: 26 }}
        >
          <span
            className="mx-auto flex h-12 w-12 items-center justify-center text-xl font-extrabold"
            style={{
              borderRadius: 13,
              background: "#211d18",
              color: "#f7f3ec",
              fontFamily: DISPLAY,
            }}
          >
            V
          </span>
          <h1 className="mt-4 text-xl font-extrabold" style={{ color: "var(--text)" }}>
            Plataforma Vectaryx
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
            Acceso exclusivo del operador
          </p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Clave de plataforma"
            autoFocus
            className="mt-5 w-full px-4 py-3 text-sm font-bold"
            style={INPUT}
          />
          {error && (
            <p className="mt-3 text-sm font-bold" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-5 w-full py-3 font-extrabold"
            style={{ borderRadius: 14, background: "#211d18", color: "#f7f3ec" }}
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  const activeCount = restaurants.filter((r) => r.active).length;
  const ordersToday = restaurants.reduce((s, r) => s + r.orders_today, 0);
  const revenueToday = restaurants.reduce((s, r) => s + r.revenue_today_cents, 0);
  const mrr = restaurants
    .filter((r) => r.active)
    .reduce((s, r) => s + r.monthly_fee_cents, 0);

  return (
    <div className="flex flex-1 flex-col px-5 py-7" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-6xl">
        {/* Métricas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Locales activos"
            value={
              <>
                {activeCount}
                <span style={{ fontSize: 18, color: "#b0a798" }}>
                  {" "}
                  / {restaurants.length}
                </span>
              </>
            }
          />
          <Metric label="Pedidos hoy" value={ordersToday} />
          <Metric label="Ventas de tenants hoy" value={formatMoney(revenueToday)} />
          <Metric label="Mensualidad recurrente" value={formatMoney(mrr)} dark />
        </div>

        {/* Restaurantes */}
        <div
          className="mt-5 overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            boxShadow: "0 40px 90px -55px rgba(33,29,24,.5)",
          }}
        >
          <header
            className="flex flex-wrap items-center gap-3.5 px-6 py-[18px]"
            style={{ borderBottom: "1px solid var(--border-2)" }}
          >
            <span
              className="flex h-[34px] w-[34px] items-center justify-center text-base font-extrabold"
              style={{
                borderRadius: 9,
                background: "#211d18",
                color: "#f7f3ec",
                fontFamily: DISPLAY,
              }}
            >
              V
            </span>
            <h1 className="text-[19px] font-extrabold" style={{ color: "var(--text)" }}>
              Restaurantes
            </h1>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="ml-auto px-4 py-2.5 text-[13.5px] font-extrabold"
              style={{ borderRadius: 11, background: "#211d18", color: "#f7f3ec" }}
            >
              {showForm ? "Cancelar" : "+ Alta de restaurante"}
            </button>
          </header>

          {showForm && (
            <form
              onSubmit={createRestaurant}
              className="flex flex-wrap gap-2 px-6 py-4"
              style={{
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border-2)",
                animation: "reveal .2s ease both",
              }}
            >
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre del restaurante"
                className="min-w-48 flex-1 px-3 py-2 text-sm"
                style={INPUT}
                required
              />
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="slug-url (opcional)"
                className="w-40 px-3 py-2 text-sm"
                style={INPUT}
              />
              <input
                value={form.pin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                placeholder="PIN staff"
                inputMode="numeric"
                className="w-28 px-3 py-2 text-sm"
                style={INPUT}
                required
              />
              <input
                value={form.fee}
                onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
                placeholder="Mensualidad S/"
                inputMode="decimal"
                className="w-32 px-3 py-2 text-sm"
                style={INPUT}
              />
              <input
                value={form.tables}
                onChange={(e) => setForm((f) => ({ ...f, tables: e.target.value }))}
                placeholder="Mesas"
                inputMode="numeric"
                className="w-20 px-3 py-2 text-sm"
                style={INPUT}
              />
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-extrabold disabled:opacity-50"
                style={{ borderRadius: 11, background: "#211d18", color: "#f7f3ec" }}
              >
                {creating ? "Creando…" : "Crear"}
              </button>
              {error && (
                <p className="w-full text-sm font-bold" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              )}
            </form>
          )}

          {/* Encabezado de columnas */}
          <div
            className="hidden gap-4 px-6 py-3 text-xs font-extrabold uppercase tracking-[0.06em] lg:grid"
            style={{
              gridTemplateColumns: GRID,
              background: "var(--surface-2)",
              color: "var(--text-faint)",
            }}
          >
            <div>Restaurante</div>
            <div>Plan · mensualidad</div>
            <div>Hoy</div>
            <div>Estado</div>
            <div className="text-right">Acción</div>
          </div>

          {restaurants.map((r) => (
            <div
              key={r.id}
              className="grid items-center gap-4 px-6 py-4 lg:grid-cols-[1.8fr_1fr_.8fr_.9fr_1.1fr]"
              style={{
                borderTop: "1px solid var(--border-2)",
                opacity: r.active ? 1 : 0.6,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center text-sm font-extrabold text-white"
                  style={{
                    borderRadius: 10,
                    background: tileColor(r.slug),
                    fontFamily: DISPLAY,
                  }}
                >
                  {initialsOf(r.name)}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate text-[15px] font-extrabold"
                    style={{ color: "var(--text)" }}
                  >
                    {r.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                    /{r.slug} · {r.table_count} mesas · {r.item_count} platos · PIN{" "}
                    {r.staff_pin}
                  </p>
                </div>
              </div>

              <div>
                <p
                  className="text-sm font-extrabold capitalize"
                  style={{ color: "var(--text)" }}
                >
                  {r.plan || "Básico"}
                </p>
                <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                  {formatMoney(r.monthly_fee_cents)}/mes
                </p>
              </div>

              <div>
                <p
                  className="text-lg font-extrabold tabular-nums"
                  style={{ color: "var(--text)", fontFamily: DISPLAY }}
                >
                  {r.orders_today}
                </p>
                <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                  {formatMoney(r.revenue_today_cents)}
                </p>
              </div>

              <div>
                <span
                  className="px-3 py-1 text-[12.5px] font-extrabold"
                  style={{
                    borderRadius: 999,
                    background: r.active ? "var(--success-soft)" : "var(--danger-soft)",
                    color: r.active ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {r.active ? "Activo" : "Suspendido"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <a
                  href={`/admin/${r.slug}`}
                  className="px-3 py-2 text-[13px] font-bold"
                  style={{
                    borderRadius: 11,
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Admin
                </a>
                <a
                  href={`/cocina/${r.slug}`}
                  className="px-3 py-2 text-[13px] font-bold"
                  style={{
                    borderRadius: 11,
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Cocina
                </a>
                <button
                  onClick={() => toggleActive(r)}
                  className="px-3 py-2 text-[13px] font-extrabold transition active:scale-[0.96]"
                  style={{
                    borderRadius: 11,
                    background: "var(--surface)",
                    border: `1px solid ${r.active ? "var(--danger)" : "var(--success)"}`,
                    color: r.active ? "var(--danger)" : "var(--success)",
                  }}
                >
                  {r.active ? "Suspender" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer
          className="mt-10 flex items-center gap-3 pt-6 text-[13px] font-semibold"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-faint)" }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center text-sm font-extrabold"
            style={{
              borderRadius: 8,
              background: "#211d18",
              color: "#f7f3ec",
              fontFamily: DISPLAY,
            }}
          >
            V
          </span>
          Vectaryx · white-label · tema por tenant vía --brand · contraste AA garantizado
        </footer>
      </div>
    </div>
  );
}
