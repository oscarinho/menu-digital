import type { Metadata } from "next";
import { Bricolage_Grotesque, Nunito_Sans } from "next/font/google";
import "./globals.css";

// Tipografías del sistema de diseño Vectaryx: títulos con carácter + cuerpo legible.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Los metadatos por defecto son los de la marca. Cada pantalla de un local los pisa
// con los suyos —nombre, icono y color del restaurante— desde su propio layout:
// ver lib/app-shell. De ahí el template "%s": el título del local manda solo, sin
// que le colguemos "Vectaryx" detrás. La tablet de la cocina es del restaurante.
export const metadata: Metadata = {
  title: {
    default: "Vectaryx · El sistema de tu restaurante",
    template: "%s",
  },
  description:
    "Pedidos desde la mesa, cocina y caja para lugares de comida. El cliente pide desde su celular, la cocina lo ve al instante y la caja cuadra sola.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
