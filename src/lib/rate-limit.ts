// Límite de peticiones en memoria.
//
// La app corre como un único proceso Node en un VPS, así que un Map basta y no
// hace falta Redis. Si algún día hay más de una instancia, esto se sustituye por
// un almacén compartido sin cambiar la interfaz.

const hits = new Map<string, number[]>();

// Evita que el Map crezca sin fin con IPs que pasaron una sola vez.
function prune(now: number, windowMs: number) {
  if (hits.size < 5_000) return;
  for (const [key, times] of hits) {
    if (times.every((t) => now - t > windowMs)) hits.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Segundos que faltan para poder reintentar (0 si `ok`). */
  retryAfter: number;
}

/**
 * ¿Se permite esta acción? Cuenta los intentos de `key` en una ventana
 * deslizante. Solo las llamadas permitidas consumen cupo: así un atacante no
 * puede alargar su propio bloqueo golpeando más fuerte, pero tampoco entra.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now, windowMs);

  const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    hits.set(key, times);
    const retryAfter = Math.ceil((windowMs - (now - times[0])) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  times.push(now);
  hits.set(key, times);
  return { ok: true, retryAfter: 0 };
}

/** Olvida los intentos de una clave (p. ej. tras un login correcto). */
export function resetRateLimit(key: string): void {
  hits.delete(key);
}

/**
 * IP del cliente. Detrás de Caddy la real viene en X-Forwarded-For: el primer
 * valor es el del cliente y los siguientes, los proxies.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
