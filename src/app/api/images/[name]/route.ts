import fs from "fs";
import path from "path";
import { uploadsDir } from "@/lib/db";

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Sirve las imágenes subidas (fotos de platos, QR de cobro). Público: el
// cliente las ve en el menú sin autenticarse.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  // Solo nombres generados por /api/upload: uuid.ext — bloquea path traversal.
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(uploadsDir(), name);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = name.split(".").pop()!;
  const body = new Uint8Array(fs.readFileSync(filePath));
  return new Response(body, {
    headers: {
      "Content-Type": TYPE_BY_EXT[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
