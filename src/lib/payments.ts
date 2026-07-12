import type { PublicRestaurant } from "@/lib/types";

export interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  description: string;
  // true: el cliente paga desde su celular (QR Yape/Plin del restaurante)
  // y la caja solo confirma; false: se cobra en mesa/caja al final.
  paysInApp: boolean;
}

const PERU_METHODS: PaymentMethod[] = [
  { id: "yape", label: "Yape", icon: "📱", description: "Paga ahora desde tu celular", paysInApp: true },
  { id: "plin", label: "Plin", icon: "💜", description: "Paga ahora desde tu celular", paysInApp: true },
  { id: "card", label: "Tarjeta", icon: "💳", description: "POS en mesa (Visa, Mastercard, Amex)", paysInApp: false },
  { id: "cash", label: "Efectivo", icon: "💵", description: "Paga en efectivo al personal", paysInApp: false },
];

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "card", label: "Tarjeta", icon: "💳", description: "POS en mesa", paysInApp: false },
  { id: "cash", label: "Efectivo", icon: "💵", description: "Paga en efectivo al personal", paysInApp: false },
];

// Métodos de cobro por país. Los procesadores online (Culqi, Mercado Pago,
// Izipay) se integran detrás de esta misma interfaz cuando el piloto lo
// requiera — el pedido guarda payment_method y la pasarela solo cambia cómo
// se confirma el pago.
export function getPaymentMethods(country: string): PaymentMethod[] {
  if (country === "PE") return PERU_METHODS;
  return DEFAULT_METHODS;
}

export function paymentLabel(id: string): string {
  const all = [...PERU_METHODS, ...DEFAULT_METHODS];
  return all.find((m) => m.id === id)?.label ?? id;
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
