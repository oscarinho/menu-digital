import Link from "next/link";

// Portada de la demo: cada tarjeta abre una de las pantallas del producto con
// los datos reales de la carta de Punto Azul.
const SURFACES = [
  {
    href: "/r/punto-azul/mesa/1",
    icon: "🍽️",
    title: "Cliente · Mesa 1",
    text: "Lo que ve quien escanea el QR: la carta con fotos, el detalle de cada plato y el pedido desde el celular.",
    hint: "Empieza por aquí",
  },
  {
    href: "/cocina/punto-azul",
    icon: "👨‍🍳",
    title: "Cocina",
    text: "El pedido cae al instante. Un toque lo avanza: recibido → en preparación → listo → entregado.",
    hint: "PIN 1234",
  },
  {
    href: "/caja/punto-azul",
    icon: "💳",
    title: "Caja",
    text: "Cuentas por mesa. Los pagos que el cliente informa por Yape o Plin se resaltan para confirmarlos.",
    hint: "PIN 1234",
  },
  {
    href: "/admin/punto-azul",
    icon: "⚙️",
    title: "Administración",
    text: "Carta, precios, agotados, mesas con su QR imprimible, logo y color de marca del local.",
    hint: "PIN 1234",
  },
  {
    href: "/plataforma",
    icon: "🏢",
    title: "Plataforma (operador)",
    text: "Alta de restaurantes, mensualidad y suspensión. Es el panel con el que Vectaryx cobra.",
    hint: "Clave privada",
  },
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SURFACES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="p-6 transition hover:-translate-y-0.5"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-2)",
                borderRadius: 22,
                boxShadow: "0 20px 40px -34px rgba(33,29,24,.35)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl" aria-hidden>
                  {s.icon}
                </span>
                <span
                  className="ml-auto px-2.5 py-1 text-[11.5px] font-extrabold"
                  style={{
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-2)",
                    color: "var(--text-faint)",
                  }}
                >
                  {s.hint}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-extrabold" style={{ color: "var(--text)" }}>
                {s.title} →
              </h2>
              <p
                className="mt-1 text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {s.text}
              </p>
            </Link>
          ))}
        </div>

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
            La carta es la de <strong style={{ color: "var(--text)" }}>Punto Azul</strong>{" "}
            (Lima). Los números de Yape y Plin son{" "}
            <strong style={{ color: "var(--warning)" }}>ficticios</strong>: es una demo, no
            transfieras dinero. Los pedidos que dejes se borran cuando la demo se reinicia.
          </p>
        </div>
      </main>
    </div>
  );
}
