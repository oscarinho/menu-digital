import type { CSSProperties } from "react";
import type { OrderStatus } from "./types";

export const DEFAULT_BRAND = "#0e6e86";

/**
 * Tono semántico de cada estado del pedido. Es constante en todos los tenants:
 * el color de marca nunca se usa para comunicar estado, para que "listo" o
 * "cancelado" signifiquen lo mismo en cualquier restaurante.
 */
export const STATUS_TONE: Record<
  OrderStatus,
  { color: string; soft: string; hint: string }
> = {
  pending: {
    color: "var(--warning)",
    soft: "var(--warning-soft)",
    hint: "La cocina ya vio tu pedido.",
  },
  preparing: {
    color: "var(--info)",
    soft: "var(--info-soft)",
    hint: "Están cocinando lo tuyo.",
  },
  ready: {
    color: "var(--success)",
    soft: "var(--success-soft)",
    hint: "Sale de cocina hacia tu mesa.",
  },
  delivered: {
    color: "var(--success)",
    soft: "var(--success-soft)",
    hint: "¡Buen provecho!",
  },
  cancelled: {
    color: "var(--danger)",
    soft: "var(--danger-soft)",
    hint: "Consulta con el personal del local.",
  },
};

/**
 * Texto legible (blanco o tinta) sobre el color de marca del tenant.
 * Se calcula por luminancia relativa para garantizar contraste AA sin que
 * cada restaurante tenga que elegir su color de texto.
 */
export function contrastOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.42 ? "#211d18" : "#ffffff";
}

/** Variables CSS de marca para inyectar en el nodo raíz de una pantalla. */
export function brandVars(hex?: string | null): CSSProperties {
  const brand = hex || DEFAULT_BRAND;
  return {
    ["--brand" as string]: brand,
    ["--brand-contrast" as string]: contrastOn(brand),
  } as CSSProperties;
}

/** Iniciales de un nombre, para usarlas cuando el tenant no tiene logo. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
