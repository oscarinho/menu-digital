"use client";

import { use } from "react";
import Carta from "@/components/Carta";

// El QR de una mesa: la carta con su número de mesa. La carta vive en <Carta>, que
// esta ruta y la de mostrador comparten.
export default function MesaPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = use(params);
  return <Carta slug={slug} code={code} />;
}
