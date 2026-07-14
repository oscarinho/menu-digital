"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import LangSwitch from "@/components/LangSwitch";
import StaffGate from "@/components/StaffGate";
import { DEFAULT_BRAND, brandVars, initialsOf } from "@/lib/brand";
import { fmt, useT, type Dict } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { Category, MenuItem, PublicRestaurant, Table } from "@/lib/types";

interface AdminData {
  restaurant: PublicRestaurant;
  tables: Table[];
  categories: Category[];
  items: MenuItem[];
}

type Tab = "menu" | "mesas" | "marca" | "cobros";

// El icono no se traduce; el nombre sí, y sale de t.admin.tabs.
const TABS: { key: Tab; icon: string }[] = [
  { key: "menu", icon: "🍽️" },
  { key: "mesas", icon: "🪑" },
  { key: "cobros", icon: "💰" },
  { key: "marca", icon: "🎨" },
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

async function uploadImage(file: File, failText: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const d = await res.json();
  if (!res.ok) throw new Error(failText);
  return d.url as string;
}

// Botón que abre el selector de archivo y sube la imagen elegida.
function PhotoButton({
  t,
  label,
  onUploaded,
}: {
  t: Dict;
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
            onUploaded(await uploadImage(file, t.admin.uploadFail));
          } catch (err) {
            alert(err instanceof Error ? err.message : t.admin.uploadFail);
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
        {busy ? t.admin.uploading : label}
      </button>
    </>
  );
}

// Interruptor de disponibilidad del plato.
function AvailToggle({
  t,
  on,
  onToggle,
}: {
  t: Dict;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2"
      aria-pressed={on}
      title={on ? t.admin.available : t.admin.soldout}
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
        {on ? t.admin.available : t.admin.soldout}
      </span>
    </button>
  );
}

function AdminPanel({ slug }: { slug: string }) {
  const [t, lang, setLang] = useT("admin");
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
      for (const table of data.tables) {
        entries[table.id] = await QRCode.toDataURL(
          `${window.location.origin}/r/${slug}/mesa/${table.code}`,
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
        {t.common.loading}
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
      fmt(t.admin.pricePrompt, { name: item.name }),
      (item.price_cents / 100).toFixed(2)
    );
    if (input === null) return;
    const amount = Number(input.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return;
    patchItem(item.id, { priceCents: Math.round(amount * 100) });
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(fmt(t.admin.deleteConfirm, { name: item.name }))) return;
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
      alert(t.admin.saveFail);
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
                {t.admin.role}
              </p>
            </div>
          </div>

          <div className="pb-4">
            <LangSwitch lang={lang} onChange={setLang} />
          </div>

          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="flex shrink-0 items-center gap-2.5 px-3 py-2.5 text-sm font-bold"
                  style={{
                    borderRadius: 11,
                    background: active ? "var(--brand)" : "transparent",
                    color: active ? "var(--brand-contrast)" : "var(--text-muted)",
                  }}
                >
                  <span aria-hidden>{item.icon}</span>
                  {t.admin.tabs[item.key]}
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
                  {t.admin.tabs.menu}
                </h2>
                <span
                  className="text-[13.5px] font-semibold"
                  style={{ color: "var(--text-faint)" }}
                >
                  {fmt(t.admin.counts, {
                    items: data.items.length,
                    cats: data.categories.length,
                  })}
                </span>
              </div>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                {t.admin.menuHint}
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
                              t={t}
                              label={item.image ? t.admin.changePhoto : t.admin.photo}
                              onUploaded={(url) => patchItem(item.id, { image: url })}
                            />
                            <button
                              onClick={() => editPrice(item)}
                              className="min-w-[70px] text-base font-extrabold tabular-nums"
                              style={{
                                color: "var(--text)",
                                fontFamily: "var(--font-display), system-ui, sans-serif",
                              }}
                              title={t.admin.editPrice}
                            >
                              {formatMoney(item.price_cents, currency)} ✎
                            </button>
                            <AvailToggle
                              t={t}
                              on={!!item.available}
                              onToggle={() =>
                                patchItem(item.id, { available: !item.available })
                              }
                            />
                            <button
                              onClick={() => deleteItem(item)}
                              className="px-2 py-1 text-sm"
                              style={{ color: "var(--text-faint)" }}
                              title={t.admin.delete}
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
                    {t.admin.addItem}
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
                      <option value="">{t.admin.category}</option>
                      {data.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newItem.name}
                      onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
                      placeholder={t.admin.itemName}
                      className="min-w-40 flex-1 px-3 py-2 text-sm"
                      style={INPUT}
                    />
                    <input
                      value={newItem.price}
                      onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
                      placeholder={t.admin.price}
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
                      {t.admin.newItem}
                    </button>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap gap-2 pt-3"
                    style={{ borderTop: "1px solid var(--border-2)" }}
                  >
                    <input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder={t.admin.newCategoryPh}
                      className="min-w-40 flex-1 px-3 py-2 text-sm"
                      style={INPUT}
                    />
                    <button
                      onClick={addCategory}
                      className="px-4 py-2 text-sm font-extrabold"
                      style={{ borderRadius: 11, background: "#211d18", color: "#f7f3ec" }}
                    >
                      {t.admin.createCategory}
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
                  {t.admin.tabs.mesas}
                </h2>
                <div className="ml-auto flex gap-2">
                  <input
                    value={newTable}
                    onChange={(e) => setNewTable(e.target.value)}
                    placeholder={t.admin.tableNo}
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
                    {t.admin.createTable}
                  </button>
                </div>
              </div>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                {t.admin.tablesHint}
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {data.tables.map((table) => (
                  <figure key={table.id} className="p-3 text-center" style={CARD}>
                    {qrs[table.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrs[table.id]}
                        alt={`QR ${table.label}`}
                        className="mx-auto"
                      />
                    ) : (
                      <div
                        className="mx-auto flex h-32 items-center justify-center text-xs"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {t.admin.generatingQr}
                      </div>
                    )}
                    <figcaption
                      className="mt-2 text-sm font-extrabold"
                      style={{ color: "var(--text)" }}
                    >
                      {table.label}
                    </figcaption>
                    <a
                      href={qrs[table.id]}
                      download={`qr-mesa-${table.code}.png`}
                      className="text-xs font-bold"
                      style={{ color: "var(--brand)" }}
                    >
                      {t.admin.downloadPng}
                    </a>
                  </figure>
                ))}
              </div>
            </>
          )}

          {tab === "marca" && (
            <>
              <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                {t.admin.tabs.marca}
              </h2>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                {t.admin.brandHint}
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    {t.admin.logoCover}
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
                        {t.admin.noLogo}
                      </div>
                    )}
                    <PhotoButton
                      t={t}
                      label={
                        data.restaurant.logo ? t.admin.changeLogo : t.admin.uploadLogo
                      }
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
                        {t.admin.noCover}
                      </div>
                    )}
                    <div className="mt-3">
                      <PhotoButton
                        t={t}
                        label={
                          data.restaurant.cover_image
                            ? t.admin.changeCover
                            : t.admin.uploadCover
                        }
                        onUploaded={(url) => saveBranding({ coverImage: url })}
                      />
                    </div>
                  </div>
                </section>

                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    {t.admin.brandColor}
                  </h3>
                  <p
                    className="mb-3.5 mt-1 text-[12.5px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {t.admin.colorHint}
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
                      {t.admin.other}
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
                    {t.admin.current}{" "}
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
                    {brandSaved ? t.admin.saved : t.admin.saveColor}
                  </button>
                </section>
              </div>
            </>
          )}

          {tab === "cobros" && (
            <>
              <h2 className="text-[22px] font-extrabold" style={{ color: "var(--text)" }}>
                {t.admin.payTitle}
              </h2>
              <p className="mb-4 mt-1 text-[13.5px]" style={{ color: "var(--text-faint)" }}>
                {t.admin.payHint}
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="p-[18px]" style={CARD}>
                  <div className="flex flex-col gap-3">
                    <label>
                      <span
                        className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {t.admin.yapeNumber}
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
                        {t.admin.plinNumber}
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
                        {t.admin.staffPin}
                      </span>
                      <input
                        value={payForm.pin}
                        onChange={(e) =>
                          setPayForm((f) => ({
                            ...f,
                            pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        placeholder={t.admin.keepPin}
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
                        {t.admin.adminPin}
                      </span>
                      <input
                        value={payForm.adminPin}
                        onChange={(e) =>
                          setPayForm((f) => ({
                            ...f,
                            adminPin: e.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        placeholder={t.admin.keepPin}
                        inputMode="numeric"
                        className="w-full px-3 py-2.5 text-sm font-bold"
                        style={INPUT}
                      />
                      <span
                        className="mt-1.5 block text-[12px]"
                        style={{ color: "var(--warning)" }}
                      >
                        {t.admin.pinWarn}
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
                    {paySaved ? t.admin.saved : t.admin.saveChanges}
                  </button>
                </section>

                <section className="p-[18px]" style={CARD}>
                  <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                    {t.admin.payQr}
                  </h3>
                  <p
                    className="mb-3.5 mt-1 text-[12.5px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {t.admin.payQrHint}
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
                        {t.admin.noPayQr}
                      </div>
                    )}
                    <PhotoButton
                      t={t}
                      label={
                        data.restaurant.payment_qr ? t.admin.changeQr : t.admin.uploadQr
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
    <StaffGate slug={slug} surface="admin" role="admin">
      <AdminPanel slug={slug} />
    </StaffGate>
  );
}
