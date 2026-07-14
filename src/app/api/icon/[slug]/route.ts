import sharp from "sharp";
import { getDb } from "@/lib/db";
import { DEFAULT_BRAND, contrastOn, initialsOf } from "@/lib/brand";
import type { Restaurant } from "@/lib/types";

// El icono que queda en la tablet del local cuando instalan la app.
//
// Se dibuja al vuelo con el color y las iniciales del restaurante: así el cocinero
// ve en su escritorio el logo de SU casa, no el nuestro, y no hay que pedirle a
// nadie que nos mande un PNG antes de poder trabajar.

const TAMAÑOS = new Set([192, 512]);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pedido = Number(new URL(req.url).searchParams.get("s") ?? 512);
  const size = TAMAÑOS.has(pedido) ? pedido : 512;

  const restaurant = getDb()
    .prepare("SELECT * FROM restaurants WHERE slug = ?")
    .get(slug) as Restaurant | undefined;
  if (!restaurant) {
    return new Response("No encontrado", { status: 404 });
  }

  const brand = restaurant.brand_color || DEFAULT_BRAND;
  const tinta = contrastOn(brand);
  const iniciales = initialsOf(restaurant.name);

  // Sin esquinas redondeadas: Android e iOS recortan el icono a su manera, y una
  // esquina nuestra dentro de la suya se ve como un error. Fondo a sangre.
  // DejaVu Sans primero, y no por gusto: la imagen de producción (node:24-slim) no
  // trae ninguna tipografía, y el Dockerfile instala justo esa. Pedir solo
  // "Helvetica, Arial" hacía que el servidor no encontrara con qué dibujar y el
  // icono saliera con cuadraditos vacíos — en la tablet del cocinero.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="${brand}"/>
      <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
            font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-weight="700"
            font-size="${size * (iniciales.length > 1 ? 0.4 : 0.55)}"
            fill="${tinta}">${iniciales}</text>
    </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Un día de caché: el color de la marca se cambia poco, y cuando se cambia, el
      // icono ya instalado en la tablet tampoco se refresca solo.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
