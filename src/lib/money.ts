const CURRENCY_LOCALES: Record<string, string> = {
  PEN: "es-PE",
  MXN: "es-MX",
  COP: "es-CO",
  CLP: "es-CL",
  ARS: "es-AR",
  USD: "en-US",
  BRL: "pt-BR",
};

export function formatMoney(cents: number, currency = "PEN"): string {
  const locale = CURRENCY_LOCALES[currency] ?? "es-PE";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
