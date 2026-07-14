"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LangSwitch from "@/app/components/LangSwitch";
import { forgetOrder, isOrderOpen, recallOrder, rememberOrder } from "@/lib/active-order";
import { contrastOn, initialsOf } from "@/lib/brand";
import { fmt, useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getPaymentMethods, isInAppMethod } from "@/lib/payments";
import type { Category, MenuItem, Order, PublicRestaurant } from "@/lib/types";

interface MenuData {
  restaurant: PublicRestaurant;
  categories: Category[];
  items: MenuItem[];
}

// El pedido que esta mesa dejó abierto desde este mismo celular, si lo hay.
type OpenOrder = Pick<Order, "id" | "daily_number" | "status" | "payment_status">;

// Chips de ingredientes: cada uno viene como "emoji etiqueta", separados por '|'.
function IngredientChips({ raw }: { raw: string }) {
  const chips = raw
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <div className="mt-3.5 flex flex-wrap gap-2">
      {chips.map((chip, i) => {
        const [icon, ...rest] = chip.split(" ");
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold"
            style={{
              background: "#faf6ef",
              border: "1px solid #efe7db",
              color: "#5c5347",
            }}
          >
            <span className="text-[15px]" aria-hidden>
              {icon}
            </span>
            {rest.join(" ")}
          </span>
        );
      })}
    </div>
  );
}

function ItemImage({ item, soldoutLabel }: { item: MenuItem; soldoutLabel: string }) {
  const soldout = !item.available;
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 96,
        height: 96,
        borderRadius: 16,
        boxShadow: "inset 0 0 0 1px rgba(33,29,24,.06)",
        backgroundColor: item.image ? undefined : "#faf6ef",
        backgroundImage: item.image ? `url('${item.image}')` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 40,
      }}
    >
      {!item.image && <span aria-hidden>{item.emoji}</span>}
      {soldout && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ borderRadius: 16, background: "rgba(33,29,24,.5)" }}
        >
          <span className="text-[11px] font-extrabold tracking-wide text-white">
            {soldoutLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MesaPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = use(params);
  const router = useRouter();

  const [t, lang, setLang] = useT("menu");
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("yape");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openOrder, setOpenOrder] = useState<OpenOrder | null>(null);

  useEffect(() => {
    fetch(`/api/restaurants/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          setActiveCategory(d.categories[0]?.id ?? null);
        }
      })
      .catch(() => setError(t.menu.loadError));
    // El diccionario no debe re-disparar la carga del menú: solo se usa para el
    // mensaje de error, y volver a pedir la carta al cambiar de idioma sería absurdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ¿Esta mesa dejó un pedido a medias? Lo recordamos en este celular al enviarlo.
  // Si ya terminó (entregado y pagado, o cancelado), lo olvidamos: la próxima
  // visita a la mesa empieza limpia.
  useEffect(() => {
    const id = recallOrder(slug, code);
    if (!id) return;
    let alive = true;
    fetch(`/api/orders/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const order: OpenOrder | undefined = d?.order;
        if (!order || !isOrderOpen(order)) {
          forgetOrder(slug, code);
          setOpenOrder(null);
          return;
        }
        setOpenOrder(order);
      })
      .catch(() => {
        // Sin red no sabemos en qué va: mejor callar que mentir sobre su estado.
      });
    return () => {
      alive = false;
    };
  }, [slug, code]);

  const itemsById = useMemo(() => {
    const map: Record<string, MenuItem> = {};
    data?.items.forEach((i) => (map[i.id] = i));
    return map;
  }, [data]);

  const cartLines = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartLines.reduce((s, [, q]) => s + q, 0);
  const cartTotal = cartLines.reduce(
    (s, [id, q]) => s + (itemsById[id]?.price_cents ?? 0) * q,
    0
  );
  const currency = data?.restaurant.currency ?? "PEN";
  const methods = getPaymentMethods(data?.restaurant.country ?? "PE");
  const payingInApp = isInAppMethod(paymentMethod);
  const brand = data?.restaurant.brand_color || "#0e6e86";
  const brandContrast = contrastOn(brand);

  const add = (id: string) =>
    setCart((c) => ({ ...c, [id]: Math.min((c[id] ?? 0) + 1, 50) }));
  const remove = (id: string) =>
    setCart((c) => ({ ...c, [id]: Math.max((c[id] ?? 0) - 1, 0) }));

  async function submitOrder() {
    if (submitting || cartLines.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          tableCode: code,
          paymentMethod,
          notes,
          items: cartLines.map(([id, quantity]) => ({ id, quantity })),
        }),
      });
      const d = await res.json();
      // El servidor responde en español (es su idioma, no el del comensal), así que
      // aquí mostramos el nuestro: un chino que ve fallar el envío no necesita el
      // detalle, necesita saber que no salió y volver a intentarlo.
      if (!res.ok) throw new Error(t.menu.sendError);
      // Antes de irnos: si cierra la pestaña, esto es lo único que le devuelve
      // a su pedido cuando vuelva a escanear el QR de la mesa.
      rememberOrder(slug, code, d.id);
      router.push(`/pedido/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.menu.sendError);
      setSubmitting(false);
    }
  }

  if (error && !data) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-8 text-center"
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
        {t.menu.loading}
      </div>
    );
  }

  const r = data.restaurant;
  const initials = initialsOf(r.name);

  if (!r.active) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center p-8 text-center"
        style={{ background: "var(--bg)" }}
      >
        {r.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.logo}
            alt=""
            className="h-16 w-16 rounded-full object-cover opacity-70"
            style={{ border: "1px solid var(--border)" }}
          />
        ) : (
          <p className="text-4xl">😴</p>
        )}
        <h1 className="mt-3 text-lg font-extrabold" style={{ color: "var(--text)" }}>
          {r.name}
        </h1>
        <p className="mt-2 max-w-sm" style={{ color: "var(--text-muted)" }}>
          {t.menu.closed}
        </p>
      </div>
    );
  }

  const brandVars = {
    ["--brand" as string]: brand,
    ["--brand-contrast" as string]: brandContrast,
  } as React.CSSProperties;

  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{ ...brandVars, background: "var(--bg)", paddingBottom: 120 }}
    >
      {/* ===== Portada ===== */}
      <div
        className="relative"
        style={{
          height: 230,
          backgroundImage: `linear-gradient(180deg, rgba(20,15,10,.15), rgba(20,15,10,.72))${
            r.cover_image ? `, url('${r.cover_image}')` : ""
          }`,
          backgroundColor: r.cover_image ? undefined : brand,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Lo primero que se ve al escanear el QR, y lo primero que necesita un
            turista que no lee español. */}
        <div className="absolute right-5 top-4">
          <LangSwitch lang={lang} onChange={setLang} />
        </div>

        <div className="absolute inset-x-5 bottom-4 mx-auto flex max-w-xl items-end gap-3.5">
          {r.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.logo}
              alt=""
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                objectFit: "cover",
                boxShadow: "0 8px 20px -6px rgba(0,0,0,.5)",
                border: "2px solid rgba(255,255,255,.35)",
                background: "#fff",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center font-extrabold"
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: brand,
                color: brandContrast,
                fontFamily: "var(--font-display)",
                fontSize: 24,
                boxShadow: "0 8px 20px -6px rgba(0,0,0,.5)",
                border: "2px solid rgba(255,255,255,.35)",
              }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1">
            <div
              className="font-extrabold text-white"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 23,
                lineHeight: 1.1,
                textShadow: "0 2px 8px rgba(0,0,0,.4)",
              }}
            >
              {r.name}
            </div>
            {r.address && (
              <div
                className="mt-0.5 font-semibold"
                style={{
                  color: "rgba(255,255,255,.9)",
                  fontSize: 13,
                  textShadow: "0 1px 4px rgba(0,0,0,.5)",
                }}
              >
                {r.address}
              </div>
            )}
          </div>
          <span
            className="font-extrabold"
            style={{
              background: "rgba(255,255,255,.95)",
              color: "#211d18",
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              boxShadow: "0 6px 16px -6px rgba(0,0,0,.5)",
            }}
          >
            {fmt(t.common.table, { n: code })}
          </span>
        </div>
      </div>

      {/* ===== Pedido en curso de esta mesa (si volvió a la carta) ===== */}
      {openOrder && (
        <button
          onClick={() => router.push(`/pedido/${openOrder.id}`)}
          className="flex w-full items-center gap-3 text-left"
          style={{
            background: brand,
            color: brandContrast,
            padding: "14px 16px",
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-extrabold"
            style={{
              borderRadius: 11,
              background: "rgba(255,255,255,.2)",
            }}
          >
            #{openOrder.daily_number}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-extrabold">{t.menu.openOrder}</span>
            <span className="block text-[12.5px] font-semibold opacity-80">
              {openOrder.payment_status === "claimed"
                ? t.menu.waitingCaja
                : t.status[openOrder.status]}
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-extrabold">{t.menu.see}</span>
        </button>
      )}

      {/* ===== Barra de categorías (sticky) ===== */}
      <div
        className="noscroll sticky top-0 z-20 flex gap-2 overflow-x-auto"
        style={{
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #efe7db",
          padding: "12px 16px",
        }}
      >
        <div className="mx-auto flex w-full max-w-xl gap-2">
          {data.categories.map((c) => {
            const on = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className="whitespace-nowrap font-bold"
                style={{
                  fontSize: 13.5,
                  padding: "8px 15px",
                  borderRadius: 999,
                  color: on ? "var(--brand)" : "#463f35",
                  background: on
                    ? "color-mix(in oklab, var(--brand), #fff 88%)"
                    : "#fff",
                  border: on
                    ? "1px solid color-mix(in oklab, var(--brand), #fff 68%)"
                    : "1px solid #ddd4c6",
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Menú ===== */}
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-2">
        <h3
          className="font-extrabold uppercase"
          style={{
            fontSize: 15,
            letterSpacing: ".09em",
            color: "#9a9086",
            margin: "22px 4px 12px",
          }}
        >
          {data.categories.find((c) => c.id === activeCategory)?.name}
        </h3>
        <ul className="flex flex-col gap-3.5">
          {data.items
            .filter((i) => i.category_id === activeCategory)
            .map((item) => {
              const qty = cart[item.id] ?? 0;
              const soldout = !item.available;
              const isOpen = expandedId === item.id;
              const hasMore = !!(item.detail || item.ingredients);
              const longText = item.detail || item.description;
              return (
                <li
                  key={item.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #ede5d8",
                    borderRadius: 22,
                    overflow: "hidden",
                    boxShadow:
                      "0 1px 2px rgba(33,29,24,.03), 0 14px 30px -26px rgba(33,29,24,.4)",
                  }}
                >
                  <div
                    onClick={() =>
                      hasMore &&
                      setExpandedId((id) => (id === item.id ? null : item.id))
                    }
                    className="flex gap-3.5 p-3.5"
                    style={{ cursor: hasMore ? "pointer" : "default" }}
                  >
                    <ItemImage item={item} soldoutLabel={t.menu.soldoutBadge} />
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-extrabold"
                        style={{ fontSize: 16, lineHeight: 1.2 }}
                      >
                        {item.name}
                      </div>
                      {!isOpen && (
                        <div
                          className="mt-1"
                          style={{ fontSize: 13.5, color: "#6b6258", lineHeight: 1.4 }}
                        >
                          {item.description}
                        </div>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2.5">
                        <div
                          className="font-extrabold"
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 18,
                            color: "var(--brand)",
                          }}
                        >
                          {formatMoney(item.price_cents, currency)}
                        </div>
                        {soldout ? (
                          <span
                            className="font-extrabold"
                            style={{
                              fontSize: 12,
                              color: "var(--danger)",
                              background: "var(--danger-soft)",
                              padding: "7px 14px",
                              borderRadius: 999,
                            }}
                          >
                            {t.menu.soldout}
                          </span>
                        ) : qty > 0 ? (
                          <div
                            className="flex items-center gap-0.5"
                            style={{ background: "var(--brand)", borderRadius: 999, padding: 3 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => remove(item.id)}
                              className="flex items-center justify-center"
                              style={{
                                width: 34,
                                height: 34,
                                border: "none",
                                borderRadius: 999,
                                background: "transparent",
                                color: brandContrast,
                                fontSize: 22,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              −
                            </button>
                            <span
                              className="text-center font-extrabold"
                              style={{ minWidth: 22, color: brandContrast, fontSize: 15 }}
                            >
                              {qty}
                            </span>
                            <button
                              onClick={() => add(item.id)}
                              className="flex items-center justify-center"
                              style={{
                                width: 34,
                                height: 34,
                                border: "none",
                                borderRadius: 999,
                                background: "rgba(255,255,255,.22)",
                                color: brandContrast,
                                fontSize: 20,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              add(item.id);
                            }}
                            className="font-extrabold"
                            style={{
                              border: "none",
                              borderRadius: 999,
                              padding: "9px 20px",
                              background: "var(--brand)",
                              color: brandContrast,
                              fontSize: 14,
                            }}
                          >
                            {t.menu.add}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "2px 16px 18px", animation: "reveal .22s ease both" }}>
                      <div style={{ height: 1, background: "#f0e8db", marginBottom: 14 }} />
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: "#463f35" }}>
                        {longText}
                      </div>
                      <IngredientChips raw={item.ingredients} />
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      </main>

      {/* ===== Botón flotante Ver pedido ===== */}
      {cartCount > 0 && !checkoutOpen && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed inset-x-4 z-20 mx-auto flex max-w-xl items-center gap-3"
          style={{
            bottom: 22,
            border: "none",
            borderRadius: 18,
            padding: "16px 20px",
            background: "var(--brand)",
            color: brandContrast,
            boxShadow: "0 18px 34px -14px color-mix(in oklab, var(--brand), #000 20%)",
          }}
        >
          <span
            className="flex items-center justify-center font-extrabold"
            style={{
              minWidth: 28,
              height: 28,
              padding: "0 8px",
              borderRadius: 999,
              background: "rgba(255,255,255,.28)",
              fontSize: 14,
              animation: "pop .3s",
            }}
          >
            {cartCount}
          </span>
          <span className="font-extrabold" style={{ fontSize: 16 }}>
            {t.menu.viewOrder}
          </span>
          <span
            className="ml-auto font-extrabold"
            style={{ fontFamily: "var(--font-display)", fontSize: 17 }}
          >
            {formatMoney(cartTotal, currency)}
          </span>
        </button>
      )}

      {/* ===== Hoja de pedido ===== */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-30">
          <div
            onClick={() => setCheckoutOpen(false)}
            className="absolute inset-0"
            style={{ background: "rgba(20,15,10,.5)", animation: "fadein .2s" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl flex-col overflow-hidden"
            style={{
              maxHeight: "92%",
              background: "#fff",
              borderRadius: "28px 28px 0 0",
              boxShadow: "0 -20px 50px -20px rgba(0,0,0,.4)",
              animation: "sheetup .3s cubic-bezier(.2,.9,.3,1) both",
            }}
          >
            <div className="flex justify-center pt-3.5 pb-1.5">
              <span style={{ width: 44, height: 5, borderRadius: 999, background: "#e3dacb" }} />
            </div>
            <div className="flex items-center px-5 pb-3 pt-1">
              <h3 className="font-extrabold" style={{ fontSize: 22 }}>
                {t.menu.yourOrder}
              </h3>
              <span className="ml-auto font-bold" style={{ fontSize: 13, color: "#8a8177" }}>
                {fmt(t.common.table, { n: code })}
              </span>
            </div>

            <div className="noscroll overflow-y-auto px-5">
              <div className="flex flex-col">
                {cartLines.map(([id, q]) => {
                  const item = itemsById[id];
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 py-3"
                      style={{ borderBottom: "1px solid #f3ece1" }}
                    >
                      <span
                        className="flex items-center justify-center"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "#faf6ef",
                          fontSize: 18,
                          overflow: "hidden",
                        }}
                      >
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          item.emoji
                        )}
                      </span>
                      <span
                        className="font-extrabold"
                        style={{ color: "var(--brand)", fontSize: 14, minWidth: 26 }}
                      >
                        {q}×
                      </span>
                      <span className="flex-1 font-semibold" style={{ fontSize: 14.5 }}>
                        {item.name}
                      </span>
                      <span className="font-extrabold" style={{ fontSize: 14.5 }}>
                        {formatMoney(item.price_cents * q, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 mb-1.5 font-extrabold" style={{ fontSize: 14 }}>
                {t.menu.notes}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.menu.notesPh}
                style={{
                  width: "100%",
                  minHeight: 64,
                  resize: "none",
                  border: "1px solid #e7dfd2",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  background: "#fbf7f0",
                  color: "#211d18",
                }}
              />

              <div className="mt-5 mb-2.5 font-extrabold" style={{ fontSize: 14 }}>
                {t.menu.howPay}
              </div>
              <div className="grid grid-cols-2 gap-2.5 pb-3">
                {methods.map((m) => {
                  const on = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className="flex items-center gap-2.5 text-left"
                      style={{
                        border: `2px solid ${on ? "var(--brand)" : "#eee7db"}`,
                        background: on
                          ? "color-mix(in oklab, var(--brand), #fff 88%)"
                          : "#fff",
                        borderRadius: 15,
                        padding: "12px 13px",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{m.icon}</span>
                      <span className="min-w-0">
                        <span
                          className="block font-extrabold"
                          style={{ fontSize: 14, color: "#211d18" }}
                        >
                          {t.pay[m.id]?.label ?? m.id}
                        </span>
                        <span
                          className="block"
                          style={{ fontSize: 11.5, color: "#8a8177", lineHeight: 1.2 }}
                        >
                          {t.pay[m.id]?.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mb-2" style={{ fontSize: 14, color: "var(--danger)" }}>
                  {error}
                </p>
              )}
            </div>

            <div
              style={{
                padding: "14px 22px 26px",
                borderTop: "1px solid #f0e8db",
                background: "#fff",
              }}
            >
              <button
                onClick={submitOrder}
                disabled={submitting || cartLines.length === 0}
                className="flex w-full items-center justify-center gap-2.5 font-extrabold"
                style={{
                  border: "none",
                  borderRadius: 18,
                  padding: 17,
                  background: "var(--brand)",
                  color: brandContrast,
                  fontSize: 16,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  t.menu.sending
                ) : (
                  <>
                    {t.menu.send}
                    <span style={{ opacity: 0.85 }}>·</span>
                    {formatMoney(cartTotal, currency)}
                  </>
                )}
              </button>
              <p className="mt-2 text-center" style={{ fontSize: 12, color: "#8a8177" }}>
                {payingInApp ? t.menu.payInApp : t.menu.payLater}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
