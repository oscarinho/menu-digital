import { metadataDelLocal, viewportDelLocal } from "@/lib/app-shell";

// Tres líneas para que esta pantalla se instale como la app del local: su icono,
// su nombre y el color de su marca hasta en la barra del sistema.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return metadataDelLocal((await params).slug, "Caja");
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }) {
  return viewportDelLocal((await params).slug);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
