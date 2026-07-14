"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import LangSwitch from "@/components/LangSwitch";
import { IconAdmin, IconCaja, IconCocina, IconSalon } from "@/components/icons";
import { brandVars, contrastOn, initialsOf, DEFAULT_BRAND } from "@/lib/brand";
import { fmt, useT } from "@/lib/i18n";
import type { PublicRestaurant, Table } from "@/lib/types";

// La puerta del local: lo que el personal abre en la tablet.
//
// Es del restaurante, no nuestra: mandan su logo y su color, y la palabra Vectaryx
// no aparece por ninguna parte. El cocinero que enciende la tablet tiene que ver la
// casa donde trabaja, no la marca del proveedor de software.
//
// El PIN se pide al entrar a una pantalla, no aquí: la sesión es del local, así que
// se teclea una vez y la tablet se queda dentro.

const PANTALLAS = [
  { key: "cocina", Icon: IconCocina, admin: false },
  { key: "caja", Icon: IconCaja, admin: false },
  { key: "salon", Icon: IconSalon, admin: false },
  { key: "admin", Icon: IconAdmin, admin: true },
] as const;

interface Data {
  restaurant: PublicRestaurant;
  tables: Table[];
}

export default function Puerta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [t, lang, setLang] = useT("hub");
  const [data, setData] = useState<Data | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    fetch(`/api/restaurants/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no está"))))
      .then(setData)
      .catch(() => setFallo(true));
  }, [slug]);

  if (fallo) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-8"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          {t.hub.notFound}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-8"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-faint)" }}>
          {t.common.loading}
        </p>
      </div>
    );
  }

  const r = data.restaurant;
  const brand = r.brand_color || DEFAULT_BRAND;
  const sobreMarca = contrastOn(brand);
  const hints: Record<string, string> = {
    cocina: t.hub.cocinaHint,
    caja: t.hub.cajaHint,
    salon: t.hub.salonHint,
    admin: t.hub.adminHint,
  };

  const tarjeta = (p: (typeof PANTALLAS)[number]) => (
    <Link
      key={p.key}
      href={`/${p.key}/${slug}`}
      className="flex items-center gap-4 p-5 transition hover:-translate-y-0.5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 18,
        boxShadow: "0 18px 36px -32px rgba(33,29,24,.4)",
      }}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center"
        style={{ borderRadius: 14, background: `${brand}14`, color: brand }}
      >
        <p.Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
          {t.nav[p.key]}
        </span>
        <span
          className="mt-0.5 block text-[12.5px] font-semibold"
          style={{ color: "var(--text-faint)" }}
        >
          {hints[p.key]}
        </span>
      </span>
      <span className="text-lg" style={{ color: "var(--text-faint)" }} aria-hidden>
        →
      </span>
    </Link>
  );

  const titulo = (texto: string) => (
    <h2
      className="mt-10 text-[12px] font-extrabold uppercase tracking-[0.14em]"
      style={{ color: "var(--text-faint)" }}
    >
      {texto}
    </h2>
  );

  return (
    <div className="flex flex-1 flex-col" style={{ ...brandVars(brand), background: "var(--bg)" }}>
      <header className="px-6 py-8" style={{ background: brand }}>
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4">
          {r.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.logo}
              alt=""
              className="h-14 w-14 shrink-0 object-cover"
              style={{ borderRadius: 16 }}
            />
          ) : (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center text-base font-extrabold"
              style={{
                borderRadius: 16,
                background: "rgba(255,255,255,.18)",
                color: sobreMarca,
              }}
            >
              {initialsOf(r.name)}
            </span>
          )}
          <h1
            className="min-w-0 flex-1 text-2xl font-extrabold tracking-tight"
            style={{ color: sobreMarca, fontFamily: "var(--font-display), system-ui" }}
          >
            {r.name}
          </h1>
          <LangSwitch lang={lang} onChange={setLang} tone="dark" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {titulo(t.hub.staffTitle)}
        <div className="mt-3 grid gap-2.5">{PANTALLAS.filter((p) => !p.admin).map(tarjeta)}</div>

        {titulo(t.hub.ownerTitle)}
        <div className="mt-3 grid gap-2.5">{PANTALLAS.filter((p) => p.admin).map(tarjeta)}</div>

        {titulo(t.hub.dinerTitle)}
        <div
          className="mt-3 p-5"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-2)",
            borderRadius: 18,
          }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t.hub.dinerHint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.tables.map((mesa) => (
              <Link
                key={mesa.id}
                href={`/r/${slug}/mesa/${mesa.code}`}
                className="px-3.5 py-2 text-[13px] font-extrabold tabular-nums transition hover:-translate-y-0.5"
                style={{
                  borderRadius: 999,
                  background: "var(--surface)",
                  border: "1px solid var(--border-2)",
                  color: "var(--text)",
                }}
              >
                {fmt(t.common.table, { n: mesa.code })}
              </Link>
            ))}
          </div>
        </div>

        {/* Lo que convierte esto en una app y no en una web: que el navegador
            desaparezca. Se dice aquí porque es donde el dueño monta la tablet. */}
        <div
          className="mt-8 p-5"
          style={{
            background: `${brand}12`,
            border: "1px solid var(--border-2)",
            borderRadius: 18,
          }}
        >
          <p className="text-[13.5px] font-extrabold" style={{ color: "var(--text)" }}>
            {t.hub.installTitle}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t.hub.installText}
          </p>
        </div>
      </main>
    </div>
  );
}
