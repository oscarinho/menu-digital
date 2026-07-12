"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import StaffGate from "@/app/components/StaffGate";
import { DEFAULT_BRAND, brandVars, initialsOf } from "@/lib/brand";
import { formatMoney } from "@/lib/money";
import type { Category, MenuItem, PublicRestaurant, Table } from "@/lib/types";

interface AdminData {
  restaurant: PublicRestaurant;
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
}

type Tab = "menu" | "mesas" | "marca" | "cobros";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "menu", label: "Carta", icon: "🍽️" },
  { key: "mesas", label: "Mesas & QR", icon: "🪑" },
  { key: "cobros", label: "Cobros y seguridad", icon: "💰" },
  { key: "marca", label: "Marca & local", icon: "🎨" },
];

const CARD: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-2)",
  borderRadius: 16,
};

const INPUT: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 11,
  color: "var(--text)",
};

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "No se pudo subir la imagen");
  return d.url as string;
}

// Botón que abre el selector de archivo y sube la imagen elegida.
function PhotoButton({
  label,
  onUploaded,
}: {
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onUploaded(await uploadImage(file));
          } catch (err) {
            alert(err instanceof Error ? err.message : "Error al subir");
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="px-3 py-1.5 text-[13px] font-bold disabled:opacity-50"
        style={{
          borderRadius: 10,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        {busy ? "Subiendo…" : label}
      </button>
    </>
  );
}

// Interruptor de disponibilidad del plato.
function AvailToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2"
      aria-pressed={on}
      title={on ? "Disponible" : "Agotado"}
    >
      <span
        className="relative block h-[27px] w-[46px] transition-colors"
        style={{ borderRadius: 999, background: on ? "var(--success)" : "var(--border)" }}
      >
        <span
          className="absolute top-[3px] block h-[21px] w-[21px] transition-[left]"
          style={{
            left: on ? 22 : 3,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }}
        />
      </span>
      <span
        className="min-w-[64px] text-left text-[12.5px] font-extrabold"
        style={{ color: on ? "var(--success)" : "var(--danger)" }}
      >
        {on ? "Disponible" : "Agotado"}
      </span>
    </button>
  );
}

function AdminPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("menu");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState({ categoryId: "", name: "", price: "" });
  const [newTable, setNewTable] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [payForm, setPayForm] = useState({
    yape: "",
    plin: "",
    pin: "",
    adminPin: "",
  });
  const [paySaved, setPaySaved] = useState(false);
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND);
  const [brandSaved, setBrandSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/restaurants/${slug}`, { cache: "no-store" });
    const d = await res.json();
    if (res.ok) {
      setData(d);
      setPayForm((f) => ({
        ...f,
        yape: d.restaurant.yape_number,
        plin: d.restaurant.plin_number,
      }));
      setBrandColor(d.restaurant.brand_color || DEFAULT_BRAND);
    }
  }, [slug]);

  useEffect(() => {
    // load() es asíncrona: el setState ocurre tras el await de fetch, no en el
    // cuerpo del efecto, así que no hay renders en cascada que evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!data || tab !== "mesas") return;
    let alive = true;
    import("qrcode").then(async (QRCode) => {
      const entries: Record<string, string> = {};
      for (const t of data.tables) {
        entries[t.id] = await QRCode.toDataURL(
          `${window.location.origin}/r/${slug}/mesa/${t.code}`,
          { width: 240, margin: 1 }
        );
      }
      if (alive) setQrs(entries);
    });
    return () => {
      alive = false;
    };
  }, [data, tab, slug]);

  if (!data) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--text-faint)" }}
      >
        Cargando…
      </div>
    );
  }

  const currency = data.restaurant.currency;

  async function patchItem(id: string, body: Record<string, unknown>) {
    await fetch(`/api/menu-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function editPrice(item: MenuItem) {
    const input = window.prompt(
      `Nuevo precio de "${item.name}" en soles (ej. 35.50):`,
      (item.price_cents / 100).toFixed(2)
    );
    if (input === null) return;
    const soles = Number(input.replace(",", "."));
    if (!Number.isFinite(soles) || soles < 0) return;
    patchItem(item.id, { priceCents: Math.round(soles * 100) });
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`¿Eliminar "${item.name}" del menú?`)) return;
    await fetch(`/api/menu-items/${item.id}`, { method: "DELETE" });
    load();
  }

  async function addItem() {
    const price = Number(newItem.price.replace(",", "."));
    if (!newItem.name.trim() || !newItem.categoryId || !Number.isFinite(price)) return;
    await fetch("/api/menu-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantSlug: slug,
        categoryId: newItem.categoryId,
        name: newItem.name,
        priceCents: Math.round(price * 100),
      }),
    });
    setNewItem({ categoryId: "", name: "", price: "" });
    load();
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantSlug: slug, name: newCategory }),
    });
    setNewCategory("");
    load();
  }

  async function addTable() {
    if (!newTable.trim()) return;
    await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantSlug: slug, code: newTable.trim() }),
    });
    setNewTable("");
    load();
  }

  async function savePayments() {
    const body: Record<string, string> = {
      yapeNumber: payForm.yape,
      plinNumber: payForm.plin,
    };
    if (payForm.pin) body.staffPin = payForm.pin;
    if (payForm.adminPin) body.adminPin = payForm.adminPin;
    const res = await fetch(`/api/restaurants/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setPaySaved(true);
      setTimeout(() => setPaySaved(false), 2500);
      setPayForm((f) => ({ ...f, pin: "", adminPin: "" }));
      load();
    } else {
      const d = await res.json();
      alert(d.error ?? "No se pudo guardar");
    }
  }

  async function saveBranding(body: Record<string, string>, feedback = false) {
    const res = await fetch(`/api/restaurants/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && feedback) {
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2500);
    }
    load();
  }

  async function setPaymentQr(url: string) {
    await fetch(`/api/restaurants/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentQr: url }),
    });
    load();
  }

  return (
    // El color elegido tematiza el panel en vivo, aun antes de guardarlo.
    <div
      className="flex flex-1 justify-center px-5 py-7"
      style={{ ...brandVars(brandColor), background: "var(--bg)" }}
    >
      <div
        className="grid w-full max-w-6xl overflow-hidden md:grid-cols-[250px_1fr]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          boxShadow: "0 40px 90px -55px rgba(33,29,24,.5)",
        }}
      >
        {/* Barra lateral */}
        <aside
          className="px-4 py-[22px]"
          style={{
            background: "var(--surface-2)",
            borderRight: "1px solid var(--border-2)",
          }}
        >
          <div className="flex items-center gap-2.5 px-1.5 pb-5">
            {data.restaurant.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.restaurant.logo}
                alt=""
                className="h-[38px] w-[38px] object-cover"
                style={{ borderRadius: 10, border: "1px solid var(--border-2)" }}
              />
            ) : (
              <span
                className="flex h-[38px] w-[38px] items-center justify-center text-sm font-extrabold"
                style={{
                  borderRadius: 10,
                  background: "var(--brand)",
                  color: "var(--brand-contrast)",
                  fontFamily: "var(--font-display), system-ui, sans-serif",
                }}
              >
                {initialsOf(data.restaurant.name)}
              </span>
            )}
            <div className="min-w-0">
              <p
                className="truncate text-[15px] font-extrabold leading-none"
                style={{ color: "var(--text)" }}
              >
                {data.restaurant.name}
              </p>
              <p
                className="mt-1 text-[11.5px] font-semibold"
                style={{ color: "var(--text-faint)" }}
              >
                Admin
              </p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex shrink-0 items-center gap-2.5 px-3 py-2.5 text-sm font-bold"
                  style={{
                    borderRadius: 11,
                    background: active ? "var(--brand)" : "transparent",
                    color: active ? "var(--brand-contrast)" : "var(--text-muted)",
                  }}
                >
                  <span aria-hidden>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Contenido */}
        <main className="p-6 md:px-7 md:py-[26px]">
          {tab === "menu" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                  Carta
                </h2>
                <span
                  className="text-[13.5px] font-semibold"
                  style={{ color: "var(--text-faint)" }}
                >
                  {data.items.length} platos · {data.categories.length} categorías
                </span>
              </div>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                Toca el interruptor para marcar un plato como agotado. Se refleja al
                instante en el menú del cliente.
              </p>

              <div className="space-y-5">
                {data.categories.map((cat) => (
                  <section key={cat.id}>
                    <h3
                      className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.08em]"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {cat.name}
                    </h3>
                    <div className="overflow-hidden" style={CARD}>
                      {data.items
                        .filter((i) => i.category_id === cat.id)
                        .map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3.5 px-4 py-3"
                            style={{
                              borderTop: idx === 0 ? "none" : "1px solid var(--border-2)",
                              background: item.available
                                ? "transparent"
                                : "var(--surface-2)",
                            }}
                          >
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt=""
                                className="h-10 w-10 shrink-0 object-cover"
                                style={{ borderRadius: 10 }}
                              />
                            ) : (
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center text-xl"
                                style={{ borderRadius: 10, background: "#faf6ef" }}
                              >
                                {item.emoji}
                              </span>
                            )}
                            <span
                              className="min-w-0 flex-1 truncate text-[14.5px] font-bold"
                              style={{
                                color: item.available ? "var(--text)" : "var(--text-faint)",
                                textDecoration: item.available ? "none" : "line-through",
                              }}
                            >
                              {item.name}
                            </span>
                            <PhotoButton
                              label={item.image ? "📷 Cambiar" : "📷 Foto"}
                              onUploaded={(url) => patchItem(item.id, { image: url })}
                            />
                            <button
                              onClick={() => editPrice(item)}
                              className="min-w-[70px] text-base font-extrabold tabular-nums"
                              style={{
                                color: "var(--text)",
                                fontFamily: "var(--font-display), system-ui, sans-serif",
                              }}
                              title="Editar precio"
                            >
                              {formatMoney(item.price_cents, currency)} ✎
                            </button>
                            <AvailToggle
                              on={!!item.available}
                              onToggle={() =>
                                patchItem(item.id, { available: !item.available })
                              }
                            />
                            <button
                              onClick={() => deleteItem(item)}
                              className="px-2 py-1 text-sm"
                              style={{ color: "var(--text-faint)" }}
                              title="Eliminar"
                            >
                              🗑
                            </button>
                          </div>
                        ))}
                    </div>
                  </section>
                ))}

                <section
                  className="p-4"
                  style={{
                    borderRadius: 16,
                    border: "2px dashed var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    Agregar producto
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={newItem.categoryId}
                      onChange={(e) =>
                        setNewItem((s) => ({ ...s, categoryId: e.target.value }))
                      }
                      className="px-3 py-2 text-sm font-semibold"
                      style={INPUT}
                    >
                      <option value="">Categoría…</option>
                      {data.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newItem.name}
                      onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Nombre del plato"
                      className="min-w-40 flex-1 px-3 py-2 text-sm"
                      style={INPUT}
                    />
                    <input
                      value={newItem.price}
                      onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
                      placeholder="Precio (S/)"
                      inputMode="decimal"
                      className="w-28 px-3 py-2 text-sm"
                      style={INPUT}
                    />
                    <button
                      onClick={addItem}
                      className="px-4 py-2 text-sm font-extrabold"
                      style={{
                        borderRadius: 11,
                        background: "var(--brand)",
                        color: "var(--brand-contrast)",
                      }}
                    >
                      + Nuevo plato
                    </button>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap gap-2 pt-3"
                    style={{ borderTop: "1px solid var(--border-2)" }}
                  >
                    <input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Nueva categoría (ej. Menú del día)"
                      className="min-w-40 flex-1 px-3 py-2 text-sm"
                      style={INPUT}
                    />
                    <button
                      onClick={addCategory}
                      className="px-4 py-2 text-sm font-extrabold"
                      style={{ borderRadius: 11, background: "#211d18", color: "#f7f3ec" }}
                    >
                      Crear categoría
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}

          {tab === "mesas" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                  Mesas & QR
                </h2>
                <div className="ml-auto flex gap-2">
                  <input
                    value={newTable}
                    onChange={(e) => setNewTable(e.target.value)}
                    placeholder="N° de mesa"
                    className="w-28 px-3 py-2 text-sm"
                    style={INPUT}
                  />
                  <button
                    onClick={addTable}
                    className="px-4 py-2 text-sm font-extrabold"
                    style={{
                      borderRadius: 11,
                      background: "var(--brand)",
                      color: "var(--brand-contrast)",
                    }}
                  >
                    Crear mesa
                  </button>
                </div>
              </div>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                Imprime cada QR y pégalo en su mesa. Al escanearlo, el cliente entra
                directo al menú de esa mesa.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {data.tables.map((t) => (
                  <figure key={t.id} className="p-3 text-center" style={CARD}>
                    {qrs[t.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrs[t.id]} alt={`QR ${t.label}`} className="mx-auto" />
                    ) : (
                      <div
                        className="mx-auto flex h-32 items-center justify-center text-xs"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Generando QR…
                      </div>
                    )}
                    <figcaption
                      className="mt-2 text-sm font-extrabold"
                      style={{ color: "var(--text)" }}
                    >
                      {t.label}
                    </figcaption>
                    <a
                      href={qrs[t.id]}
                      download={`qr-mesa-${t.code}.png`}
                      className="text-xs font-bold"
                      style={{ color: "var(--brand)" }}
                    >
                      Descargar PNG
                    </a>
                  </figure>
                ))}
              </div>
            </>
          )}

          {tab === "marca" && (
            <>
              <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                Marca & local
              </h2>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                Esto es lo que ve tu cliente al escanear el QR: tu logo, tu portada y tu
                color. Un solo token re-tematiza todo el producto.
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    Logo y portada
                  </h3>
                  <div className="mt-3.5 flex items-center gap-4">
                    {data.restaurant.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.restaurant.logo}
                        alt="Logo"
                        className="h-20 w-20 object-cover"
                        style={{ borderRadius: 18, border: "1px solid var(--border-2)" }}
                      />
                    ) : (
                      <div
                        className="flex h-20 w-20 items-center justify-center text-center text-xs"
                        style={{
                          borderRadius: 18,
                          border: "2px dashed var(--border)",
                          color: "var(--text-faint)",
                        }}
                      >
                        Sin logo
                      </div>
                    )}
                    <PhotoButton
                      label={data.restaurant.logo ? "📷 Cambiar logo" : "📷 Subir logo"}
                      onUploaded={(url) => saveBranding({ logo: url })}
                    />
                  </div>

                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-2)" }}>
                    {data.restaurant.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.restaurant.cover_image}
                        alt="Portada"
                        className="h-32 w-full object-cover"
                        style={{ borderRadius: 14 }}
                      />
                    ) : (
                      <div
                        className="flex h-32 w-full items-center justify-center text-sm"
                        style={{
                          borderRadius: 14,
                          border: "2px dashed var(--border)",
                          color: "var(--text-faint)",
                        }}
                      >
                        Sin foto de portada
                      </div>
                    )}
                    <div className="mt-3">
                      <PhotoButton
                        label={
                          data.restaurant.cover_image
                            ? "📷 Cambiar portada"
                            : "📷 Subir portada"
                        }
                        onUploaded={(url) => saveBranding({ coverImage: url })}
                      />
                    </div>
                  </div>
                </section>

                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    Color de marca
                  </h3>
                  <p
                    className="mb-3.5 mt-1 text-[12.5px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Un token re-tematiza todo el producto. El contraste del texto se
                    calcula solo.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      "#0e6e86",
                      "#d33a2c",
                      "#1e9e5a",
                      "#9a5b34",
                      "#7c3aed",
                      "#db2777",
                      "#ea580c",
                      "#0f766e",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setBrandColor(c)}
                        aria-label={`Color ${c}`}
                        className="h-[42px] w-[42px] transition active:scale-90"
                        style={{
                          borderRadius: 12,
                          background: c,
                          border: `3px solid ${
                            brandColor === c ? "var(--text)" : "transparent"
                          }`,
                          boxShadow: `0 4px 10px -4px ${c}`,
                        }}
                      />
                    ))}
                    <label
                      className="flex items-center gap-2 text-sm font-semibold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Otro:
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-[42px] w-12 cursor-pointer"
                        style={{ borderRadius: 12, border: "1px solid var(--border)" }}
                      />
                    </label>
                  </div>

                  <p className="mt-3.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                    Actual:{" "}
                    <code
                      className="px-2 py-0.5 font-bold"
                      style={{
                        borderRadius: 6,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-2)",
                      }}
                    >
                      {brandColor}
                    </code>
                  </p>

                  <button
                    onClick={() => saveBranding({ brandColor }, true)}
                    className="mt-4 w-full py-3 text-sm font-extrabold"
                    style={{
                      borderRadius: 12,
                      background: "var(--brand)",
                      color: "var(--brand-contrast)",
                    }}
                  >
                    {brandSaved ? "Guardado ✓" : "Guardar color"}
                  </button>
                </section>
              </div>
            </>
          )}

          {tab === "cobros" && (
            <>
              <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                Cobros digitales
              </h2>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                Con esto tus clientes pagan desde su celular apenas piden: ven tu QR,
                yapean y avisan; la caja solo confirma.
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="p-[18px]" style={CARD}>
                  <div className="flex flex-col gap-3">
                    <label>
                      <span
                        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Número Yape
                      </span>
                      <input
                        value={payForm.yape}
                        onChange={(e) => setPayForm((f) => ({ ...f, yape: e.target.value }))}
                        placeholder="999 888 777"
                        className="w-full px-3 py-2.5 text-sm font-bold"
                        style={INPUT}
                      />
                    </label>
                    <label>
                      <span
                        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Número Plin
                      </span>
                      <input
                        value={payForm.plin}
                        onChange={(e) => setPayForm((f) => ({ ...f, plin: e.target.value }))}
                        placeholder="999 888 777"
                        className="w-full px-3 py-2.5 text-sm font-bold"
                        style={INPUT}
                      />
                    </label>
                    <label>
                      <span
                        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        PIN del personal · cocina y caja (4–6 dígitos)
                      </span>
                      <input
                        value={payForm.pin}
                        onChange={(e) =>
                          setPayForm((f) => ({
                            ...f,
                            pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        placeholder="Dejar vacío para no cambiar"
                        inputMode="numeric"
                        className="w-full px-3 py-2.5 text-sm font-bold"
                        style={INPUT}
                      />
                    </label>
                    <label>
                      <span
                        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        PIN del dueño · esta pantalla (4–6 dígitos)
                      </span>
                      <input
                        value={payForm.adminPin}
                        onChange={(e) =>
                          setPayForm((f) => ({
                            ...f,
                            adminPin: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        placeholder="Dejar vacío para no cambiar"
                        inputMode="numeric"
                        className="w-full px-3 py-2.5 text-sm font-bold"
                        style={INPUT}
                      />
                      <span
                        className="mt-1.5 block text-[12px]"
                        style={{ color: "var(--warning)" }}
                      >
                        Ponle uno distinto al del personal: con este PIN se cambian los
                        precios y el número de Yape al que llega tu dinero.
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={savePayments}
                    className="mt-4 w-full py-3 text-sm font-extrabold"
                    style={{
                      borderRadius: 12,
                      background: "var(--brand)",
                      color: "var(--brand-contrast)",
                    }}
                  >
                    {paySaved ? "Guardado ✓" : "Guardar cambios"}
                  </button>
                </section>

                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    QR de cobro
                  </h3>
                  <p
                    className="mb-3.5 mt-1 text-[12.5px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Sube la imagen del QR que te da tu app de Yape o Plin. Es lo que verá
                    el cliente al pagar.
                  </p>
                  <div className="flex items-center gap-4">
                    {data.restaurant.payment_qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.restaurant.payment_qr}
                        alt="QR de cobro"
                        className="h-28 w-28 object-contain p-1"
                        style={{ borderRadius: 14, border: "1px solid var(--border-2)" }}
                      />
                    ) : (
                      <div
                        className="flex h-28 w-28 items-center justify-center text-center text-xs"
                        style={{
                          borderRadius: 14,
                          border: "2px dashed var(--border)",
                          color: "var(--text-faint)",
                        }}
                      >
                        Sin QR de cobro
                      </div>
                    )}
                    <PhotoButton
                      label={
                        data.restaurant.payment_qr ? "📷 Cambiar QR" : "📷 Subir QR de cobro"
                      }
                      onUploaded={setPaymentQr}
                    />
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return (
    <StaffGate slug={slug} title="Administración" role="admin">
      <AdminPanel slug={slug} />
    </StaffGate>
  );
}
