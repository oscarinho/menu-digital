"use client";

import { use } from "react";
import Carta from "@/components/Carta";

// El QR único del mostrador: la misma carta, pero sin mesa. El pedido nace de
// mostrador (lo recoge el propio cliente) y la carta pide su nombre, opcional.
export default function MostradorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <Carta slug={slug} code={null} />;
}
