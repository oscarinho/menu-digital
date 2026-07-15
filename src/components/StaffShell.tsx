"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LangSwitch from "@/components/LangSwitch";
import { IconAdmin, IconCaja, IconCocina, IconSalon } from "@/components/icons";
import { brandVars, contrastOn, initialsOf, DEFAULT_BRAND } from "@/lib/brand";
import type { Dict, Lang } from "@/lib/i18n";
import type { ServiceMode } from "@/lib/types";

// La cabecera de todas las pantallas del local.
//
// Antes cada una se inventaba la suya, con un emoji y el slug al lado ("Cocina ·
// punto-azul"). Eso son tres páginas web sueltas, no una aplicación: por eso se veía
// todo mezclado.
//
// Ahora las tres traen la misma barra, con la casa donde trabaja quien la mira y las
// demás pantallas a un toque. La cocina es oscura y la caja y el salón claros —el
// pase se mira de lejos y con las manos ocupadas, la caja de cerca—, pero la
// estructura es la misma, y eso es lo que hace que se reconozcan como una sola app.

export type StaffSurface = "cocina" | "caja" | "salon" | "admin";

const PANTALLAS: { key: StaffSurface; Icon: typeof IconCocina }[] = [
  { key: "cocina", Icon: IconCocina },
  { key: "caja", Icon: IconCaja },
  { key: "salon", Icon: IconSalon },
  { key: "admin", Icon: IconAdmin },
];

export interface Marca {
  name: string;
  logo?: string;
  brandColor?: string;
  // Cuando es 'despacho', la barra no muestra la pestaña de Salón.
  serviceMode?: ServiceMode;
}

export default function StaffShell({
  slug,
  surface,
  restaurant,
  t,
  lang,
  onLang,
  tone = "light",
  connected,
  actions,
  children,
}: {
  slug: string;
  surface: StaffSurface;
  restaurant: Marca | null;
  t: Dict;
  lang: Lang;
  onLang: (l: Lang) => void;
  tone?: "light" | "dark";
  /** Solo aparece si la pantalla vigila la conexión (la cocina). */
  connected?: boolean;
  /** Botones propios de la pantalla (el sonido, en cocina). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  const brand = restaurant?.brandColor || DEFAULT_BRAND;
  // En despacho no hay salón; la pestaña desaparece de la barra igual que en la puerta.
  const pantallas = PANTALLAS.filter(
    (p) => !(p.key === "salon" && restaurant?.serviceMode === "despacho")
  );

  const c = dark
    ? {
        bg: "#211d18",
        bar: "#17130e",
        line: "#332c24",
        text: "#f7f3ec",
        faint: "#a99e8e",
        chip: "#2b241c",
      }
    : {
        bg: "var(--bg)",
        bar: "var(--surface)",
        line: "var(--border-2)",
        text: "var(--text)",
        faint: "var(--text-faint)",
        chip: "var(--surface-2)",
      };

  return (
    // brandVars pone --brand y --brand-contrast a los colores de ESTE local: sin
    // esto, el botón de "Liberar mesa" del salón salía con el color por defecto de
    // Vectaryx en vez de con el del restaurante.
    <div className="flex flex-1 flex-col" style={{ ...brandVars(brand), background: c.bg }}>
      <header
        className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6"
        style={{ background: c.bar, borderBottom: `1px solid ${c.line}` }}
      >
        {/* La casa. Se toca y se vuelve a la puerta del local. */}
        <Link href={`/${slug}`} className="flex min-w-0 items-center gap-3">
          {restaurant?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo}
              alt=""
              className="h-9 w-9 shrink-0 object-cover"
              style={{ borderRadius: 10 }}
            />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[12px] font-extrabold"
              style={{ borderRadius: 10, background: brand, color: contrastOn(brand) }}
            >
              {restaurant ? initialsOf(restaurant.name) : "··"}
            </span>
          )}
          <span className="min-w-0">
            <span
              className="block truncate text-[15px] font-extrabold leading-tight"
              style={{ color: c.text }}
            >
              {restaurant?.name ?? " "}
            </span>
            <span
              className="block text-[11px] font-extrabold uppercase tracking-[0.1em]"
              style={{ color: c.faint }}
            >
              {t.nav[surface]}
            </span>
          </span>
        </Link>

        {/* Las otras pantallas, a un toque. Una app tiene navegación; tres páginas
            sueltas te obligan a escribir la URL a mano. */}
        <nav
          className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto"
          style={{ borderRadius: 999, background: c.chip, padding: 3 }}
        >
          {pantallas.map(({ key, Icon }) => {
            const on = key === surface;
            return (
              <Link
                key={key}
                href={`/${key}/${slug}`}
                aria-current={on ? "page" : undefined}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-extrabold transition sm:flex-none"
                style={{
                  borderRadius: 999,
                  background: on ? brand : "transparent",
                  color: on ? contrastOn(brand) : c.faint,
                }}
              >
                <Icon size={17} />
                <span className="hidden md:inline">{t.nav[key]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {actions}
          {connected !== undefined && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold"
              style={{
                borderRadius: 999,
                background: connected
                  ? dark
                    ? "#173a25"
                    : "var(--success-soft)"
                  : dark
                    ? "#3d1f1c"
                    : "var(--danger-soft)",
                color: connected
                  ? dark
                    ? "#6ee7a5"
                    : "var(--success)"
                  : dark
                    ? "#fca5a5"
                    : "var(--danger)",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
              {connected ? t.kitchen.live : t.common.offline}
            </span>
          )}
          <LangSwitch lang={lang} onChange={onLang} tone={tone} />
        </div>
      </header>

      {children}
    </div>
  );
}
