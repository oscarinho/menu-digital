import { NextResponse } from "next/server";
import {
  createPlatformSession,
  destroyPlatformSession,
  isPlatformAdmin,
  platformKey,
  secretEquals,
} from "@/lib/auth";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const key = `platform-login:${clientIp(req)}`;
  const limit = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${limit.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const body = (await req.json()) as { key?: string };
  if (!secretEquals(String(body.key ?? ""), platformKey())) {
    return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  resetRateLimit(key);
  await createPlatformSession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ authorized: await isPlatformAdmin() });
}

export async function DELETE() {
  await destroyPlatformSession();
  return NextResponse.json({ ok: true });
}
