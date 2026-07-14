"use client";

import { useEffect, useState, type ReactNode } from "react";
import LangSwitch from "@/app/components/LangSwitch";
import { useT, type Surface } from "@/lib/i18n";
import type { StaffRole } from "@/lib/types";

// Puerta de acceso del personal: pide el PIN del restaurante una vez y abre
// sesión (cookie httpOnly de 30 días). Envuelve cocina, caja, salón y admin.
//
// `role="admin"` exige el PIN del dueño: con el de cocina/caja no se entra a la
// administración, donde se cambian precios y el número de Yape del local.
//
// El selector de idioma va AQUÍ, no solo dentro: si el cocinero chino tuviera que
// pasar la puerta para poder cambiarlo, la puerta estaría en un idioma que no lee.
// Comparte clave con la pantalla que envuelve, así que lo que elija aquí es lo que
// se encuentra al entrar.
export default function StaffGate({
  slug,
  surface,
  role = "staff",
  children,
}: {
  slug: string;
  surface: Extract<Surface, "cocina" | "caja" | "salon" | "admin">;
  role?: StaffRole;
  children: ReactNode;
}) {
  const [t, lang, setLang] = useT(surface);
  const [state, setState] = useState<"checking" | "login" | "ok">("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth?slug=${slug}&role=${role}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState(d.authorized ? "ok" : "login"))
      .catch(() => setState("login"));
  }, [slug, role]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin }),
      });
      const d = await res.json();
      // El mensaje del servidor viene en español; el de la pantalla, en el idioma
      // que el usuario eligió aquí mismo. Manda el suyo.
      if (!res.ok) throw new Error(t.gate.wrongPin);
      // PIN correcto, pero es el del personal y esta pantalla es la del dueño.
      if (role === "admin" && d.role !== "admin") {
        throw new Error(t.gate.notAdmin);
      }
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.gate.connError);
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "ok") return <>{children}</>;

  if (state === "checking") {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--text-faint)" }}
      >
        {t.gate.checking}
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <form
        onSubmit={login}
        className="w-full max-w-sm p-8 text-center"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 26,
          boxShadow: "0 30px 60px -45px rgba(33,29,24,.5)",
        }}
      >
        <div className="flex justify-center">
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
        <p className="mt-4 text-3xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-3 text-xl font-extrabold" style={{ color: "var(--text)" }}>
          {t.nav[surface]}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
          {role === "admin" ? t.gate.adminPrompt : t.gate.staffPrompt}
        </p>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="••••"
          className="mt-5 w-full px-4 py-3 text-center text-2xl font-extrabold tracking-[0.5em] outline-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            color: "var(--text)",
          }}
        />
        {error && (
          <p className="mt-3 text-sm font-bold" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || pin.length < 4}
          className="mt-5 w-full py-3 font-extrabold transition active:scale-[0.98] disabled:opacity-50"
          style={{
            borderRadius: 16,
            background: "var(--brand)",
            color: "var(--brand-contrast)",
          }}
        >
          {submitting ? t.gate.verifying : t.gate.enter}
        </button>
        <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
          {role === "admin" ? t.gate.adminHint : t.gate.staffHint}
        </p>
      </form>
    </div>
  );
}
