import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { uploadsDir } from "@/lib/db";
import { requireStaff, staffSession } from "@/lib/auth";

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Ancho máximo servido. Un celular no aprovecha más, y la carta la abre gente
// con datos móviles: guardar el original de 4 MB era pasarle la factura al
// comensal. Una carta de 100 platos baja de ~200 MB potenciales a ~10 MB.
const MAX_WIDTH = 1400;
const QUALITY = 80;

// Sube una imagen (foto de plato, logo, portada o QR de cobro). Solo el dueño.
export async function POST(req: Request) {
  const session = await staffSession();
  if (!session || !(await requireStaff(session.restaurant.id, "admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: "Formato no soportado (usa JPG, PNG o WebP)" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 4 MB" }, { status: 400 });
  }

  const name = `${randomUUID()}.webp`;
  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(input)
      // Respeta la orientación EXIF: sin esto, las fotos de celular salen tumbadas.
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "No pudimos procesar esa imagen" },
      { status: 400 }
    );
  }

  fs.writeFileSync(path.join(uploadsDir(), name), output);
  return NextResponse.json({ url: `/api/images/${name}` }, { status: 201 });
}
