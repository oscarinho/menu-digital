"use client";

import Link from "next/link";
import LangSwitch from "@/components/LangSwitch";
import { useT } from "@/lib/i18n";

// La cara del producto: lo que ve el dueño de un restaurante que todavía no nos ha
// comprado nada.
//
// Aquí NO va el índice de la demo. Una portada que lista dos restaurantes de
// mentira y, debajo, todas sus pantallas internas con el PIN al lado, es el índice
// de un desarrollador: le enseña al cliente las tripas de la máquina en vez del
// producto. Eso vive ahora en /demo, que es lo que es.
//
// Y el panel de plataforma —donde le cobramos al restaurante— no se enlaza desde
// aquí. Es nuestro. El cliente no tiene por qué verlo.

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div
      className="flex gap-4 p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 18,
      }}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
          {title}
        </h3>
        <p
          className="mt-1.5 text-[13.5px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function Size({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="p-5"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-2)",
        borderRadius: 18,
      }}
    >
      <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {text}
      </p>
    </div>
  );
}

export default function Landing() {
  const [t, lang, setLang] = useT("home");

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--bg)" }}>
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-6 py-6">
        <span
          className="flex h-9 w-9 items-center justify-center text-lg font-extrabold"
          style={{
            borderRadius: 10,
            background: "#211d18",
            color: "#f7f3ec",
            fontFamily: "var(--font-display), system-ui, sans-serif",
          }}
        >
          V
        </span>
        <span
          className="text-[15px] font-extrabold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {t.landing.eyebrow}
        </span>
        <div className="ml-auto">
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20">
        <section className="pt-10 sm:pt-16">
          <h1
            className="max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl"
            style={{ color: "var(--text)", fontFamily: "var(--font-display), system-ui" }}
          >
            {t.landing.h1}
          </h1>
          <p
            className="mt-6 max-w-2xl text-lg leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {t.landing.lead}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="px-6 py-3.5 text-[15px] font-extrabold transition hover:-translate-y-0.5"
              style={{
                borderRadius: 999,
                background: "var(--text)",
                color: "var(--surface)",
              }}
            >
              {t.landing.ctaDemo} →
            </Link>
            <a
              href="mailto:hola@vectaryx.com"
              className="px-6 py-3.5 text-[15px] font-extrabold transition hover:-translate-y-0.5"
              style={{
                borderRadius: 999,
                background: "transparent",
                border: "1px solid var(--border-2)",
                color: "var(--text)",
              }}
            >
              {t.landing.ctaTalk}
            </a>
          </div>
        </section>

        <section className="mt-20">
          <h2
            className="text-[13px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-faint)" }}
          >
            {t.landing.featuresTitle}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Feature icon="📱" title={t.landing.f1t} text={t.landing.f1d} />
            <Feature icon="🔥" title={t.landing.f2t} text={t.landing.f2d} />
            <Feature icon="💳" title={t.landing.f3t} text={t.landing.f3d} />
            <Feature icon="🪑" title={t.landing.f4t} text={t.landing.f4d} />
            <Feature icon="🌏" title={t.landing.f5t} text={t.landing.f5d} />
          </div>
        </section>

        <section className="mt-20">
          <h2
            className="text-2xl font-extrabold tracking-tight sm:text-3xl"
            style={{ color: "var(--text)", fontFamily: "var(--font-display), system-ui" }}
          >
            {t.landing.forWhoTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t.landing.forWhoLead}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Size title={t.landing.smallT} text={t.landing.smallD} />
            <Size title={t.landing.midT} text={t.landing.midD} />
            <Size title={t.landing.bigT} text={t.landing.bigD} />
          </div>
        </section>

        {/* Lo que todavía no está, dicho por nosotros y no descubierto por el
            cliente a media demo. Un piloto que se entera solo de que no hay boleta
            no vuelve a coger el teléfono. */}
        <section
          className="mt-14 p-6"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-2)",
            borderRadius: 20,
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>{t.landing.soonTitle}</strong>{" "}
            {t.landing.soonText}
          </p>
        </section>
      </main>

      <footer
        className="border-t px-6 py-8 text-center text-[12.5px] font-semibold"
        style={{ borderColor: "var(--border-2)", color: "var(--text-faint)" }}
      >
        {t.landing.footer}
      </footer>
    </div>
  );
}
