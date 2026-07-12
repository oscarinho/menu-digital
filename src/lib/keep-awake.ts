"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras la vista esté abierta.
 *
 * En cocina y caja la tablet pasa horas sin que nadie la toque: si se duerme, el
 * equipo deja de ver las comandas que entran, justo en el peor momento. El
 * navegador suelta el bloqueo al minimizar la pestaña, así que se vuelve a pedir
 * cuando la vista reaparece.
 *
 * Sin soporte (Safari iOS antiguo, o HTTP sin TLS) no hace nada: es una mejora,
 * no un requisito.
 */
export function useKeepAwake(): void {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // El navegador puede negarlo (batería baja, permisos): no es crítico.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);
}
