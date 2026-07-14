"use client";

import Link from "next/link";
import LangSwitch from "@/app/components/LangSwitch";
import { initialsOf } from "@/lib/brand";
import { fmt, useT, type Lang } from "@/lib/i18n";

// Portada de la demo. Dos restaurantes de verdad sobre la misma app: es la forma
// más corta de enseñar que cada local trae su carta, su marca y hasta su idioma.
//
// La descripción de cada local va aquí y no en el diccionario: es contenido de la
// demo, no de la aplicación. El día que la portada deje de ser un escaparate, esto se
// va con ella.
const TENANTS: {
  slug: string;
  name: string;
  brand: string;
  tag: Record<Lang, string>;
  text: Record<Lang, string>;
}[] = [
  {
    slug: "punto-azul",
    name: "Punto Azul",
    brand: "#0a5aa8",
    tag: {
      es: "Cevichería · Lima",
      en: "Ceviche house · Lima",
      zh: "秘鲁海鲜餐厅 · 利马",
    },
    text: {
      es: "113 platos, 33 con foto. La carta real que se sirve hoy en el local.",
      en: "113 dishes, 33 with photos. The real menu they serve today.",
      zh: "113 道菜，其中 33 道配有照片。这是店里今天真实在用的菜单。",
    },
  },
  {
    slug: "lanzhou-noodles",
    name: "Lanzhou Noodles",
    brand: "#1f5c3d",
    tag: {
      es: "Fideos de Lanzhou · Lima",
      en: "Lanzhou noodles · Lima",
      zh: "兰州拉面 · 利马",
    },
    text: {
      es: "34 platos con el nombre en chino y la traducción debajo, como la carta impresa.",
      en: "34 dishes named in Chinese with the translation underneath, just like the printed menu.",
      zh: "34 道菜，中文菜名下方附有西语翻译，和纸质菜单一样。",
    },
  },
];

// Las mesas que trae cada local sembrado. Aquí hacen de QR: en el restaurante de
// verdad, cada una tiene el suyo pegado en la mesa.
const TABLE_CODES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const SURFACES = [
  { key: "cocina", icon: "👨‍🍳", href: (s: string) => `/cocina/${s}` },
  { key: "caja", icon: "💳", href: (s: string) => `/caja/${s}` },
  { key: "salon", icon: "🪑", href: (s: string) => `/salon/${s}` },
  { key: "admin", icon: "⚙️", href: (s: string) => `/admin/${s}` },
] as const;

export default function Home() {
  const [t, lang, setLang] = useT("home");

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
            {t.home.demo}
          </p>
          <div className="ml-auto">
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
        </div>

        <h1
          className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          {t.home.h1}
        </h1>
        <p
          className="mt-4 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {t.home.lead}
        </p>

        <p
          className="mt-10 text-[13px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          {t.home.twoRestaurants}
        </p>

        {TENANTS.map((r) => (
          <section
            key={r.slug}
            className="mt-4 overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: 22,
              boxShadow: "0 20px 40px -34px rgba(33,29,24,.35)",
            }}
          >
            <header className="flex items-center gap-3 p-5" style={{ background: r.brand }}>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center text-sm font-extrabold"
                style={{ borderRadius: 13, background: "rgba(255,255,255,.18)", color: "#fff" }}
              >
                {initialsOf(r.name)}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold" style={{ color: "#fff" }}>
                  {r.name}
                </h2>
                <p
                  className="text-[12.5px] font-semibold"
                  style={{ color: "rgba(255,255,255,.72)" }}
                >
                  {r.tag[lang]}
                </p>
              </div>
            </header>

            <p className="px-5 pt-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {r.text[lang]}
            </p>

            {/* Cada local tiene sus 10 mesas, pero la portada solo enlazaba la 1: se
                pedía siempre desde la misma y el salón quedaba con nueve mesas
                muertas. Aquí estos chips hacen de QR — en el local de verdad, cada
                mesa tiene el suyo pegado en la madera. */}
            <div className="px-5 pt-4">
              <p
                className="text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
                style={{ color: "var(--text-faint)" }}
              >
                {t.home.orderHere}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {TABLE_CODES.map((code) => (
                  <Link
                    key={code}
                    href={`/r/${r.slug}/mesa/${code}`}
                    className="px-3.5 py-2 text-[13px] font-extrabold tabular-nums transition hover:-translate-y-0.5"
                    style={{
                      borderRadius: 999,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-2)",
                      color: "var(--text)",
                    }}
                  >
                    {fmt(t.common.table, { n: code })}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-2 p-5 sm:grid-cols-2">
              {SURFACES.map((s) => (
                <Link
                  key={s.key}
                  href={s.href(r.slug)}
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
                      {t.nav[s.key]} →
                    </span>
                    <span
                      className="block text-[11.5px] font-semibold"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {t.home.pinHint}
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
              {t.home.platform}
            </span>
            <span
              className="mt-1 block text-sm leading-relaxed"
              style={{ color: "rgba(247,243,236,.66)" }}
            >
              {t.home.platformText}
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
            <strong style={{ color: "var(--text)" }}>{t.home.liveTitle}</strong>{" "}
            {t.home.liveText}
          </p>
          <p className="mt-2">
            {t.home.fakeLead}{" "}
            <strong style={{ color: "var(--warning)" }}>{t.home.fake}</strong>
            {t.home.demoWarn}
          </p>
        </div>
      </main>
    </div>
  );
}
