"use client";

import { LANGS, type Lang } from "@/lib/i18n";

// Tres letras y ya. Nada de banderas: una bandera dice país, no idioma, y el mismo
// español lo hablan el Perú y media América. Tampoco un desplegable: en la cocina
// esto se toca con prisa y con el dorso del dedo.
//
// Va en la cabecera de cada pantalla, incluida la del PIN: el cocinero chino tiene
// que poder leer "请输入员工 PIN 码" ANTES de entrar, no después.
export default function LangSwitch({
  lang,
  onChange,
  tone = "light",
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      role="group"
      aria-label="Idioma / Language / 语言"
      className="flex shrink-0 items-center gap-0.5 p-0.5"
      style={{
        borderRadius: 999,
        background: dark ? "#17130e" : "var(--surface-2)",
        border: `1px solid ${dark ? "#3a332a" : "var(--border-2)"}`,
      }}
    >
      {LANGS.map((l) => {
        const on = l.id === lang;
        return (
          <button
            key={l.id}
            // Sin esto, dentro del <form> del PIN sería un botón de envío: cambiar de
            // idioma mandaba el formulario vacío y contestaba "PIN incorrecto".
            type="button"
            onClick={() => onChange(l.id)}
            aria-label={l.aria}
            aria-pressed={on}
            className="px-2.5 py-1 text-[12px] font-extrabold transition"
            style={{
              borderRadius: 999,
              background: on ? (dark ? "#f7f3ec" : "var(--text)") : "transparent",
              color: on
                ? dark
                  ? "#17130e"
                  : "var(--surface)"
                : dark
                  ? "#b7ae9f"
                  : "var(--text-faint)",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
