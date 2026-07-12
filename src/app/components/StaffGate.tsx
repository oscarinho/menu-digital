"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StaffRole } from "@/lib/types";

// Puerta de acceso del personal: pide el PIN del restaurante una vez y abre
// sesión (cookie httpOnly de 30 días). Envuelve cocina, caja y admin.
//
// `role="admin"` exige el PIN del dueño: con el de cocina/caja no se entra a la
// administración, donde se cambian precios y el número de Yape del local.
export default function StaffGate({
  slug,
  title,
  role = "staff",
  children,
}: {
  slug: string;
  title: string;
  role?: StaffRole;
  children: ReactNode;
}) {
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
      if (!res.ok) throw new Error(d.error ?? "PIN incorrecto");
      // PIN correcto, pero es el del personal y esta pantalla es la del dueño.
      if (role === "admin" && d.role !== "admin") {
        throw new Error("Ese PIN no abre la administración. Usa el del dueño.");
      }
      setState("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
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
        Verificando acceso…
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
        <p className="text-3xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-3 text-xl font-extrabold" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
          {role === "admin"
            ? "Ingresa el PIN del dueño para continuar"
            : "Ingresa el PIN del personal para continuar"}
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
          {submitting ? "Verificando…" : "Entrar"}
        </button>
        <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
          {role === "admin"
            ? "El PIN del dueño se cambia desde Admin → Cobros y seguridad."
            : "¿No tienes el PIN? Pídelo al administrador del restaurante."}
        </p>
      </form>
    </div>
  );
}
