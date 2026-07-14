import type { Metadata, Viewport } from "next";
import { getDb } from "./db";
import { DEFAULT_BRAND } from "./brand";
import type { Restaurant } from "./types";

// Lo que hace que una pantalla del local se comporte como una app y no como una
// página: su manifest, su icono y el color de la barra del sistema.
//
// Vive aquí y no dentro de cada pantalla porque las pantallas son componentes de
// cliente ("use client") y los metadatos solo puede darlos el servidor. Cada una
// trae un layout de tres líneas que llama a esto.

function local(slug: string): Restaurant | undefined {
  return getDb().prepare("SELECT * FROM restaurants WHERE slug = ?").get(slug) as
    | Restaurant
    | undefined;
}

/**
 * Título, icono y manifest de una pantalla del local.
 *
 * El título importa más de lo que parece: es lo que queda debajo del icono en la
 * tablet y lo que se lee en la pestaña. "Cocina · Punto Azul", no "Vectaryx".
 */
export async function metadataDelLocal(slug: string, pantalla?: string): Promise<Metadata> {
  const r = local(slug);
  if (!r) return { title: "No encontrado" };

  return {
    title: pantalla ? `${pantalla} · ${r.name}` : r.name,
    // Sin esto, el navegador no ofrece instalar nada.
    manifest: `/${slug}/manifest.webmanifest`,
    icons: {
      icon: `/api/icon/${slug}?s=192`,
      apple: `/api/icon/${slug}?s=192`,
    },
    appleWebApp: {
      capable: true,
      title: r.name,
      statusBarStyle: "black-translucent",
    },
  };
}

/** El color de la marca del local tiñe hasta la barra del sistema operativo. */
export async function viewportDelLocal(slug: string): Promise<Viewport> {
  const r = local(slug);
  return {
    themeColor: r?.brand_color || DEFAULT_BRAND,
    width: "device-width",
    initialScale: 1,
    // La cocina y la caja se miran de pie y con prisa: que un doble toque no haga
    // zoom evita la mitad de los sustos.
    maximumScale: 1,
  };
}
