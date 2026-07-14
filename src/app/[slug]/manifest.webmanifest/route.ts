import { getDb } from "@/lib/db";
import { DEFAULT_BRAND } from "@/lib/brand";
import type { Restaurant } from "@/lib/types";

// El manifest de cada local: lo que hace que esto deje de ser una web y pase a ser
// una app.
//
// Con esto, el dueño añade la pantalla a la tablet y queda un icono con SU marca
// que abre a pantalla completa: sin barra de direcciones, sin pestañas, sin el
// buscador de Google asomando por arriba. Es el detalle que separa "un enlace que
// me pasaron" de "el sistema del restaurante".
//
// Hay uno por restaurante, no uno para todos: el nombre, el color y el icono son
// los del local, porque la tablet es del local.

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = getDb()
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;
  if (!restaurant) {
    return new Response("No encontrado", { status: 404 });
  }

  const brand = restaurant.brand_color || DEFAULT_BRAND;

  const manifest = {
    name: restaurant.name,
    short_name: restaurant.name.slice(0, 12),
    description: restaurant.address || restaurant.name,
    // Abre en la puerta del local: de ahí, un toque a Cocina o a Caja.
    start_url: `/${slug}`,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf7f2",
    theme_color: brand,
    icons: [
      { src: `/api/icon/${slug}?s=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/api/icon/${slug}?s=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/api/icon/${slug}?s=512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
