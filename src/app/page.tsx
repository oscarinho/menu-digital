import Link from "next/link";
import { initialsOf } from "@/lib/brand";

// Portada de la demo. Dos restaurantes de verdad sobre la misma app: es la forma
// más corta de enseñar que cada local trae su carta, su marca y hasta su idioma.
const TENANTS = [
  {
    slug: "punto-azul",
    name: "Punto Azul",
    brand: "#0a5aa8",
    tag: "Cevichería · Lima",
    text: "113 platos, 33 con foto. La carta real que se sirve hoy en el local.",
  },
  {
    slug: "lanzhou-noodles",
    name: "Lanzhou Noodles",
    brand: "#1f5c3d",
    tag: "Fideos de Lanzhou · Lima",
    text: "34 platos con el nombre en chino y la traducción debajo, como la carta impresa.",
  },
];

const SURFACES = [
  {
    key: "cliente",
    icon: "🍽️",
    title: "Cliente · Mesa 1",
    hint: "Empieza por aquí",
    href: (s: string) => `/r/${s}/mesa/1`,
  },
  { key: "cocina", icon: "👨‍🍳", title: "Cocina", hint: "PIN 1234", href: (s: string) => `/cocina/${s}` },
  { key: "caja", icon: "💳", title: "Caja", hint: "PIN 1234", href: (s: string) => `/caja/${s}` },
  { key: "admin", icon: "⚙️", title: "Administración", hint: "PIN 1234", href: (s: string) => `/admin/${s}` },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--bg)" }}>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center text-xl font-extrabold"
            style={{
              borderRadius: 11,
              background: "#211d18",
              color: "#f7f3ec",
              fontFamily: "var(--font-display), system-ui, sans-serif",
            }}
          >
            V
          </span>
          <p
            className="text-[13px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: "var(--brand)" }}
          >
            Vectaryx · demo
          </p>
        </div>

        <h1
          className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          Tu restaurante toma pedidos solo.
        </h1>
        <p
          className="mt-4 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          El cliente escanea el QR de su mesa y pide desde su celular. El pedido cae
          directo en la pantalla de cocina y la caja cobra con Yape, Plin, tarjeta o
          efectivo. Sin apps que instalar y sin comisiones de delivery.
        </p>

        <p
          className="mt-10 text-[13px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          Dos restaurantes, la misma app
        </p>

        {TENANTS.map((t) => (
          <section
            key={t.slug}
            className="mt-4 overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: 22,
              boxShadow: "0 20px 40px -34px rgba(33,29,24,.35)",
            }}
          >
            <header className="flex items-center gap-3 p-5" style={{ background: t.brand }}>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-extrabold"
                style={{ borderRadius: 13, background: "rgba(255,255,255,.18)", color: "#fff" }}
              >
                {initialsOf(t.name)}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold" style={{ color: "#fff" }}>
                  {t.name}
                </h2>
                <p
                  className="text-[12.5px] font-semibold"
                  style={{ color: "rgba(255,255,255,.72)" }}
                >
                  {t.tag}
                </p>
              </div>
            </header>

            <p className="px-5 pt-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {t.text}
            </p>

            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {SURFACES.map((s) => (
                <Link
                  key={s.key}
                  href={s.href(t.slug)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:-translate-y-0.5"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 14,
                  }}
                >
                  <span className="text-xl" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold" style={{ color: "var(--text)" }}>
                      {s.title} →
                    </span>
                    <span
                      className="block text-[11.5px] font-semibold"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {s.hint}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <Link
          href="/plataforma"
          className="mt-4 flex items-center gap-4 p-6 transition hover:-translate-y-0.5"
          style={{
            background: "#211d18",
            border: "1px solid #211d18",
            borderRadius: 22,
            boxShadow: "0 20px 40px -34px rgba(33,29,24,.35)",
          }}
        >
          <span className="text-3xl" aria-hidden>
            🏢
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-extrabold" style={{ color: "#f7f3ec" }}>
              Plataforma (operador) →
            </span>
            <span
              className="mt-1 block text-sm leading-relaxed"
              style={{ color: "rgba(247,243,236,.66)" }}
            >
              Alta de restaurantes, mensualidad y suspensión. Es el panel con el que
              Vectaryx cobra. Necesita la clave privada.
            </span>
          </span>
        </Link>

        <div
          className="mt-10 p-5 text-sm leading-relaxed"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-2)",
            borderRadius: 18,
            color: "var(--text-muted)",
          }}
        >
          <p>
            <strong style={{ color: "var(--text)" }}>Cómo verlo en vivo:</strong> abre la
            vista de cliente en tu celular y la de cocina en otra pantalla. Al enviar el
            pedido aparece en cocina en menos de 3 segundos, y al informar el pago se
            enciende en caja.
          </p>
          <p className="mt-2">
            Los números de Yape y Plin son{" "}
            <strong style={{ color: "var(--warning)" }}>ficticios</strong>: es una demo, no
            transfieras dinero. Los pedidos que dejes se borran cuando la demo se reinicia.
          </p>
        </div>
      </main>
    </div>
  );
}
