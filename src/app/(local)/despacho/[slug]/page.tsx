"use client";

import { use, useEffect, useState } from "react";
import LangSwitch from "@/components/LangSwitch";
import { brandVars, contrastOn, initialsOf, DEFAULT_BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";

// La pantalla de despacho: la TV del local, colgada a la vista de la calle. Pública,
// sin PIN. Dos columnas —Preparando / LISTO— con números gigantes que se leen desde
// la puerta. Es lo que le permite al local sin mozos avisar sin tocar el celular de
// nadie: el cliente mira, ve su número en LISTO, y viene a recogerlo.

interface Linea {
  daily_number: number;
  status: "preparing" | "ready" | string;
  customer_name: string;
}
interface Data {
  restaurant: { name: string; logo?: string; brandColor?: string };
  orders: Linea[];
}

export default function DespachoScreen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [t, lang, setLang] = useT("despacho");
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    const cargar = () =>
      fetch(`/api/despacho/${slug}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setData(d);
        })
        .catch(() => {});
    cargar();
    // La TV se refresca sola: nadie va a estar tocando esta pantalla.
    const id = setInterval(cargar, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [slug]);

  const brand = data?.restaurant.brandColor || DEFAULT_BRAND;
  const preparando = data?.orders.filter((o) => o.status === "preparing") ?? [];
  const listos = data?.orders.filter((o) => o.status === "ready") ?? [];

  const ficha = (o: Linea, destacado: boolean) => (
    <div
      key={o.daily_number}
      className="flex flex-col items-center justify-center px-4 py-5"
      style={{
        borderRadius: 20,
        background: destacado ? brand : "#2b241c",
        color: destacado ? contrastOn(brand) : "#f7f3ec",
        minWidth: 150,
      }}
    >
      <span className="font-extrabold tabular-nums leading-none" style={{ fontSize: 64 }}>
        {o.daily_number}
      </span>
      {o.customer_name && (
        <span className="mt-2 max-w-[10ch] truncate text-center text-lg font-bold opacity-90">
          {o.customer_name}
        </span>
      )}
    </div>
  );

  const columna = (
    titulo: string,
    lineas: Linea[],
    destacado: boolean,
    color: string
  ) => (
    <section className="flex min-w-0 flex-1 flex-col">
      <h2
        className="mb-5 flex items-center gap-3 text-2xl font-extrabold uppercase tracking-wide"
        style={{ color }}
      >
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        {titulo}
      </h2>
      <div className="flex flex-wrap gap-4">{lineas.map((o) => ficha(o, destacado))}</div>
    </section>
  );

  return (
    <div
      className="flex min-h-dvh flex-1 flex-col"
      style={{ ...brandVars(brand), background: "#17130e", color: "#f7f3ec" }}
    >
      <header
        className="flex items-center gap-4 px-8 py-6"
        style={{ borderBottom: "1px solid #332c24" }}
      >
        {data?.restaurant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.restaurant.logo}
            alt=""
            className="h-12 w-12 object-cover"
            style={{ borderRadius: 12 }}
          />
        ) : (
          <span
            className="flex h-12 w-12 items-center justify-center text-sm font-extrabold"
            style={{ borderRadius: 12, background: brand, color: contrastOn(brand) }}
          >
            {data ? initialsOf(data.restaurant.name) : "··"}
          </span>
        )}
        <h1 className="flex-1 text-3xl font-extrabold tracking-tight">
          {data?.restaurant.name ?? " "}
        </h1>
        <LangSwitch lang={lang} onChange={setLang} tone="dark" />
      </header>

      <main className="flex flex-1 gap-10 px-8 py-8">
        {listos.length === 0 && preparando.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xl" style={{ color: "#a99e8e" }}>
            {t.despacho.empty}
          </div>
        ) : (
          <>
            {columna(t.despacho.ready, listos, true, "#6ee7a5")}
            <div className="w-px shrink-0" style={{ background: "#332c24" }} />
            {columna(t.despacho.preparing, preparando, false, "#e8c37a")}
          </>
        )}
      </main>
    </div>
  );
}
