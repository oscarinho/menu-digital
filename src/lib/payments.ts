import type { PublicRestaurant } from "@/lib/types";

// Qué métodos existen y cómo se comportan. Cómo se LLAMAN es otra cosa: depende del
// idioma de quien mire la pantalla, y por eso vive en el diccionario (lib/i18n →
// `pay`). La misma caja la atiende un cajero peruano y la audita un dueño chino.
export interface PaymentMethod {
  id: string;
  icon: string;
  // true: el cliente paga desde su celular (QR Yape/Plin del restaurante)
  // y la caja solo confirma; false: se cobra en mesa/caja al final.
  paysInApp: boolean;
}

const PERU_METHODS: PaymentMethod[] = [
  { id: "yape", icon: "📱", paysInApp: true },
  { id: "plin", icon: "💜", paysInApp: true },
  { id: "card", icon: "💳", paysInApp: false },
  { id: "cash", icon: "💵", paysInApp: false },
];

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "card", icon: "💳", paysInApp: false },
  { id: "cash", icon: "💵", paysInApp: false },
];

// Métodos de cobro por país. Los procesadores online (Culqi, Mercado Pago,
// Izipay) se integran detrás de esta misma interfaz cuando el piloto lo
// requiera — el pedido guarda payment_method y la pasarela solo cambia cómo
// se confirma el pago.
export function getPaymentMethods(country: string): PaymentMethod[] {
  if (country === "PE") return PERU_METHODS;
  return DEFAULT_METHODS;
}

export function isInAppMethod(id: string): boolean {
  return PERU_METHODS.some((m) => m.id === id && m.paysInApp);
}

// Datos de cobro digital que el restaurante configuró en Admin → Cobros.
export function digitalPaymentInfo(r: PublicRestaurant): {
  number: string;
  qr: string;
} | null {
  if (!r.yape_number && !r.plin_number && !r.payment_qr) return null;
  return { number: r.yape_number || r.plin_number, qr: r.payment_qr };
}
