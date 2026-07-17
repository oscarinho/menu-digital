"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderStatus } from "./types";

// El idioma no es del restaurante ni del usuario: es DE LA PANTALLA.
//
// Nos lo dijo un probador con un local chino en Lima: "en la cocina son cocineros
// chinos pero en caja son personal peruano". Son dos tablets distintas, en el mismo
// local, a diez metros una de otra, y cada una necesita su idioma AL MISMO TIEMPO.
// Un ajuste por restaurante las obligaría a compartirlo; uno por cuenta de usuario
// exigiría cuentas, y aquí no hay: se entra con el PIN del turno.
//
// Por eso la preferencia vive en el localStorage del dispositivo, con una clave por
// pantalla. Se elige una vez en la tablet de cocina y se queda. Y como el dueño puede
// ser chino, peruano o americano, la administración lleva la suya, independiente.
export type Lang = "es" | "en" | "zh";

export type Surface =
  | "home"
  | "hub"
  | "menu"
  | "track"
  | "despacho"
  | "cocina"
  | "caja"
  | "salon"
  | "admin";

export const LANGS: { id: Lang; label: string; aria: string }[] = [
  { id: "es", label: "ES", aria: "Español" },
  { id: "en", label: "EN", aria: "English" },
  { id: "zh", label: "中文", aria: "中文" },
];

const KEY = (s: Surface) => `vectaryx.lang.${s}`;

function isLang(v: unknown): v is Lang {
  return v === "es" || v === "en" || v === "zh";
}

// Primera visita: el idioma del navegador. Un turista que escanea el QR con el móvil
// en inglés ve la carta en inglés sin tocar nada; a partir de ahí manda su elección.
function detect(): Lang {
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";
  return "es";
}

function read(surface: Surface): Lang {
  try {
    const saved = localStorage.getItem(KEY(surface));
    if (isLang(saved)) return saved;
  } catch {
    /* modo incógnito con el storage bloqueado: nos vale el del navegador */
  }
  return detect();
}

export function useLang(surface: Surface): [Lang, (l: Lang) => void] {
  // El primer render es "es" a propósito: en el servidor no hay localStorage ni
  // navigator, y si el cliente pintara otro idioma la hidratación no cuadraría. El
  // idioma real entra en el efecto, ya en el navegador.
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(read(surface));
  }, [surface]);

  // El <html lang> no es decoración: es lo que hace que un lector de pantalla lea en
  // chino y que el navegador no ofrezca traducir una página ya traducida.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const change = useCallback(
    (l: Lang) => {
      try {
        localStorage.setItem(KEY(surface), l);
      } catch {
        /* si no se puede guardar, al menos vale para esta sesión */
      }
      setLang(l);
    },
    [surface]
  );

  return [lang, change];
}

/** Rellena los {huecos} de una cadena traducida. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** El método de pago en el idioma de la pantalla. "Yape" es "Yape" en los tres. */
export function payLabel(t: Dict, id: string): string {
  return t.pay[id]?.label ?? id;
}

export interface Dict {
  nav: Record<"cocina" | "caja" | "salon" | "admin" | "despacho", string>;
  common: { loading: string; offline: string; min: string; table: string };
  status: Record<OrderStatus, string>;
  hint: Record<OrderStatus, string>;
  pay: Record<string, { label: string; desc: string }>;
  gate: {
    checking: string;
    staffPrompt: string;
    adminPrompt: string;
    enter: string;
    verifying: string;
    wrongPin: string;
    notAdmin: string;
    connError: string;
    staffHint: string;
    adminHint: string;
  };
  // La portada del producto: lo que ve el dueño de un restaurante que todavía no
  // nos ha comprado nada. Va en tres idiomas porque el dueño puede ser chino,
  // peruano o americano — que es exactamente de donde salió todo esto.
  landing: {
    eyebrow: string;
    h1: string;
    lead: string;
    ctaDemo: string;
    ctaTalk: string;
    featuresTitle: string;
    f1t: string;
    f1d: string;
    f2t: string;
    f2d: string;
    f3t: string;
    f3d: string;
    f4t: string;
    f4d: string;
    f5t: string;
    f5d: string;
    forWhoTitle: string;
    forWhoLead: string;
    smallT: string;
    smallD: string;
    midT: string;
    midD: string;
    bigT: string;
    bigD: string;
    soonTitle: string;
    soonText: string;
    footer: string;
  };
  // La puerta de un local: la pantalla que abre el personal en la tablet.
  hub: {
    staffTitle: string;
    ownerTitle: string;
    dinerTitle: string;
    cocinaHint: string;
    cajaHint: string;
    salonHint: string;
    adminHint: string;
    despachoHint: string;
    dinerHint: string;
    counterLink: string;
    counterHint: string;
    seeMenu: string;
    installTitle: string;
    installText: string;
    notFound: string;
  };
  home: {
    demo: string;
    h1: string;
    lead: string;
    twoRestaurants: string;
    orderHere: string;
    pinHint: string;
    platform: string;
    platformText: string;
    liveTitle: string;
    liveText: string;
    fakeLead: string;
    fake: string;
    demoWarn: string;
  };
  menu: {
    loading: string;
    loadError: string;
    search: string;
    noResults: string;
    allCats: string;
    closed: string;
    soldout: string;
    soldoutBadge: string;
    add: string;
    viewOrder: string;
    yourOrder: string;
    counterBadge: string;
    counterName: string;
    counterNamePh: string;
    notes: string;
    notesPh: string;
    howPay: string;
    send: string;
    sending: string;
    sendError: string;
    payInApp: string;
    payLater: string;
    openOrder: string;
    waitingCaja: string;
    see: string;
  };
  track: {
    loading: string;
    orderNo: string;
    currentStatus: string;
    inProgress: string;
    demoWarn: string;
    payWith: string;
    payScanPre: string;
    payPre: string;
    payPost: string;
    qrAlt: string;
    holder: string;
    iPaid: string;
    claiming: string;
    payProofPrompt: string;
    payProofHint: string;
    payProofReading: string;
    payProofReady: string;
    payProofChange: string;
    claimedTitle: string;
    claimedPre: string;
    paidWord: string;
    claimedPost: string;
    waitingCaja: string;
    paidWith: string;
    payAtVenue: string;
    payAtVenueWith: string;
    chargedAtTable: string;
    total: string;
    orderMore: string;
    autoRefresh: string;
    readyTitle: string;
    readyTab: string;
  };
  despacho: {
    preparing: string;
    ready: string;
    empty: string;
  };
  kitchen: {
    cols: Record<"pending" | "preparing" | "ready", string>;
    next: Record<"pending" | "preparing" | "ready", string>;
    done: string;
    empty: string;
    noneDone: string;
    cancel: string;
    backToReady: string;
    soundOn: string;
    soundOff: string;
    live: string;
  };
  caja: {
    toCharge: string;
    claimed1: string;
    claimedN: string;
    colTable: string;
    colTotal: string;
    colState: string;
    colAction: string;
    noOpen: string;
    items: string;
    claimedChip: string;
    toChargeChip: string;
    confirm: string;
    charge: string;
    cancel: string;
    paidToday: string;
    revert: string;
    changeMethod: string;
    verifyTitle: string;
    proofTitle: string;
    noProof: string;
    viewProof: string;
    opNumber: string;
    opNumberPh: string;
    amountReceived: string;
    tip: string;
  };
  salon: {
    free: string;
    closed: string;
    pending: string;
    preparing: string;
    ready: string;
    claimed: string;
    tocharge: string;
    occupied1: string;
    occupiedN: string;
    free1: string;
    freeN: string;
    unpaid: string;
    noTables: string;
    extra1: string;
    extraN: string;
    paidAt: string;
    freeTable: string;
    freeing: string;
  };
  admin: {
    role: string;
    tabs: Record<"menu" | "mesas" | "cobros" | "marca", string>;
    counts: string;
    menuHint: string;
    addItem: string;
    category: string;
    itemName: string;
    price: string;
    newItem: string;
    newCategoryPh: string;
    createCategory: string;
    photo: string;
    changePhoto: string;
    editPrice: string;
    delete: string;
    available: string;
    soldout: string;
    pricePrompt: string;
    deleteConfirm: string;
    uploading: string;
    uploadFail: string;
    saveFail: string;
    tablesHint: string;
    tableNo: string;
    createTable: string;
    generatingQr: string;
    downloadPng: string;
    brandHint: string;
    logoCover: string;
    noLogo: string;
    changeLogo: string;
    uploadLogo: string;
    noCover: string;
    changeCover: string;
    uploadCover: string;
    brandColor: string;
    colorHint: string;
    other: string;
    current: string;
    saveColor: string;
    serviceMode: string;
    serviceModeHint: string;
    modes: Record<"salon" | "despacho" | "mixto", { name: string; desc: string }>;
    saved: string;
    payTitle: string;
    payHint: string;
    yapeNumber: string;
    plinNumber: string;
    staffPin: string;
    adminPin: string;
    pinWarn: string;
    keepPin: string;
    saveChanges: string;
    payQr: string;
    payQrHint: string;
    noPayQr: string;
    changeQr: string;
    uploadQr: string;
  };
}

const es: Dict = {
  despacho: {
    preparing: "En preparación",
    ready: "Listo — recoger",
    empty: "Sin pedidos por ahora.",
  },
  nav: { cocina: "Cocina", caja: "Caja", salon: "Salón", admin: "Administración", despacho: "Despacho" },
  common: { loading: "Cargando…", offline: "Sin conexión", min: "min", table: "Mesa {n}" },
  status: {
    pending: "Recibido",
    preparing: "En preparación",
    ready: "Listo para servir",
    delivered: "Entregado",
    cancelled: "Cancelado",
  },
  hint: {
    pending: "La cocina ya vio tu pedido.",
    preparing: "Están cocinando lo tuyo.",
    ready: "Sale de cocina hacia tu mesa.",
    delivered: "¡Buen provecho!",
    cancelled: "Consulta con el personal del local.",
  },
  pay: {
    yape: { label: "Yape", desc: "Paga ahora desde tu celular" },
    plin: { label: "Plin", desc: "Paga ahora desde tu celular" },
    card: { label: "Tarjeta", desc: "POS en mesa (Visa, Mastercard, Amex)" },
    cash: { label: "Efectivo", desc: "Paga en efectivo al personal" },
  },
  gate: {
    checking: "Verificando acceso…",
    staffPrompt: "Ingresa el PIN del personal para continuar",
    adminPrompt: "Ingresa el PIN del dueño para continuar",
    enter: "Entrar",
    verifying: "Verificando…",
    wrongPin: "PIN incorrecto",
    notAdmin: "Ese PIN no abre la administración. Usa el del dueño.",
    connError: "Error de conexión",
    staffHint: "¿No tienes el PIN? Pídelo al administrador del restaurante.",
    adminHint: "El PIN del dueño se cambia desde Admin → Cobros y seguridad.",
  },
  landing: {
    eyebrow: "Vectaryx",
    h1: "El sistema de tu restaurante.",
    lead: "Tus clientes piden desde su mesa. La cocina lo ve al instante. La caja cuadra sola. Sin comandas de papel, sin apps que instalar y sin comisiones de delivery.",
    ctaDemo: "Ver cómo funciona",
    ctaTalk: "Quiero Vectaryx en mi local",
    featuresTitle: "Lo que hace",
    f1t: "El cliente pide sin esperar al mozo",
    f1d: "Escanea el QR de su mesa y ahí está tu carta, con fotos. Pide y paga desde su celular.",
    f2t: "La cocina lo ve al instante",
    f2d: "La comanda cae sola en la pantalla del pase, con su cronómetro. Nadie corre con papelitos.",
    f3t: "La caja cobra y cuadra",
    f3d: "Yape, Plin, tarjeta o efectivo. Al cierre, lo cobrado del día está ahí, sin sumar a mano.",
    f4t: "El salón, de un vistazo",
    f4d: "Qué mesa pidió, cuál está esperando y cuál hay que cobrar. El color lo dice todo.",
    f5t: "Cada pantalla, en su idioma",
    f5d: "Español, inglés y chino. La cocina puede estar en chino y la caja en español, a la vez.",
    forWhoTitle: "Para cualquier lugar de comida",
    forWhoLead: "El mismo sistema, del más sencillo al más completo. Pagas por lo que usas.",
    smallT: "El menú de la esquina",
    smallD: "Una carta, una cocina, una caja. Nada más que aprender.",
    midT: "La cevichería, el chifa",
    midD: "Mesas con QR, mozos, salón y cierre de caja.",
    bigT: "El restaurante formal",
    bigD: "Todo lo anterior, y lo que viene: boleta electrónica, reportes e inventario.",
    soonTitle: "Se está construyendo.",
    soonText:
      "Hoy funciona lo de arriba. La pasarela de pago, la boleta SUNAT y el inventario están en camino. Si te interesa entrar como piloto, hablamos.",
    footer: "Vectaryx · Pedidos, cocina y caja para lugares de comida · Lima, Perú",
  },
  hub: {
    staffTitle: "Personal",
    ownerTitle: "Dueño",
    dinerTitle: "El comensal",
    cocinaHint: "Las comandas del pase",
    cajaHint: "Cobros y cuentas del día",
    salonHint: "Las mesas del local",
    adminHint: "Carta, marca, mesas y cobros",
    despachoHint: "La pantalla de números para la TV del mostrador.",
    dinerHint: "Lo que ve quien escanea el QR de una mesa.",
    counterLink: "Pedir en el mostrador",
    counterHint: "El QR único del local, sin mesa.",
    seeMenu: "Ver la carta",
    installTitle: "Instálalo en la tablet",
    installText:
      "Añade esta pantalla a la pantalla de inicio y se abrirá sola, a pantalla completa, sin barra de navegador.",
    notFound: "Este restaurante no existe.",
  },
  home: {
    demo: "Vectaryx · demo",
    h1: "Tu restaurante toma pedidos solo.",
    lead: "El cliente escanea el QR de su mesa y pide desde su celular. El pedido cae directo en la pantalla de cocina y la caja cobra con Yape, Plin, tarjeta o efectivo. Sin apps que instalar y sin comisiones de delivery.",
    twoRestaurants: "Dos restaurantes, la misma app",
    orderHere: "🍽️ Pide como comensal · empieza por aquí",
    pinHint: "PIN 1234",
    platform: "Plataforma (operador) →",
    platformText:
      "Alta de restaurantes, mensualidad y suspensión. Es el panel con el que Vectaryx cobra. Necesita la clave privada.",
    liveTitle: "Cómo verlo en vivo:",
    liveText:
      "abre la vista de cliente en tu celular y la de cocina en otra pantalla. Al enviar el pedido aparece en cocina en menos de 3 segundos, y al informar el pago se enciende en caja.",
    fakeLead: "Los números de Yape y Plin son",
    fake: "ficticios",
    demoWarn:
      ": es una demo, no transfieras dinero. Los pedidos que dejes se borran cuando la demo se reinicia.",
  },
  menu: {
    loading: "Cargando menú…",
    loadError: "No se pudo cargar el menú",
    search: "Buscar un plato…",
    noResults: "No encontramos ese plato.",
    allCats: "Todo",
    closed:
      "Por ahora no estamos recibiendo pedidos digitales. Pide tu carta al personal del local.",
    soldout: "Agotado",
    soldoutBadge: "AGOTADO",
    add: "Agregar",
    viewOrder: "Ver pedido",
    yourOrder: "Tu pedido",
    counterBadge: "Para recoger",
    counterName: "¿A nombre de quién?",
    counterNamePh: "Tu nombre (para llamarte)",
    notes: "Notas para cocina",
    notesPh: "Ej: sin cebolla, término de cocción…",
    howPay: "¿Cómo pagas?",
    send: "Enviar pedido",
    sending: "Enviando a cocina…",
    sendError: "No se pudo enviar el pedido",
    payInApp: "Al enviar el pedido verás el QR para pagar desde tu celular.",
    payLater: "El pago se realiza en el local al finalizar. Tu pedido va directo a cocina.",
    openOrder: "Tienes un pedido en curso",
    waitingCaja: "Esperando que caja confirme tu pago",
    see: "Ver →",
  },
  track: {
    loading: "Cargando pedido…",
    orderNo: "Pedido #{n}",
    currentStatus: "Estado actual",
    inProgress: "En curso…",
    demoWarn: "⚠️ Demo — el número de abajo es ficticio. No transfieras dinero.",
    payWith: "Paga con {m}",
    payScanPre: "Escanea el QR o usa el número, transfiere ",
    payPre: "Transfiere ",
    payPost: " y confirma.",
    qrAlt: "QR de pago {m}",
    holder: "Titular",
    iPaid: "Ya pagué",
    claiming: "Avisando…",
    payProofPrompt: "📸 Sube la captura de tu pago",
    payProofHint: "Ayuda a la caja a confirmar más rápido",
    payProofReading: "Preparando tu captura…",
    payProofReady: "Captura lista",
    payProofChange: "Tocar para cambiarla",
    claimedTitle: "Pago informado",
    claimedPre: "Avisamos a caja. En cuanto confirmen la transferencia lo verás como ",
    paidWord: "Pagado",
    claimedPost: ".",
    waitingCaja: "Esperando confirmación de caja",
    paidWith: "Pago confirmado con {m} ✓ ¡Gracias!",
    payAtVenue: "Pago en el local",
    payAtVenueWith: "Pago con {m}",
    chargedAtTable: "Se cobra en la mesa · total {amount}",
    total: "Total",
    orderMore: "Pedir algo más",
    autoRefresh: "Esta página se actualiza sola cada pocos segundos.",
    readyTitle: "¡Tu pedido está listo!",
    readyTab: "🔔 ¡Listo!",
  },
  kitchen: {
    cols: { pending: "Recibido", preparing: "En preparación", ready: "Listo" },
    next: { pending: "Empezar a preparar", preparing: "Marcar listo", ready: "Entregar" },
    done: "Entregados hoy",
    empty: "Sin comandas",
    noneDone: "Nada entregado todavía",
    cancel: "Anular",
    backToReady: "↩ Volver a listo",
    soundOn: "🔔 Sonido activo",
    soundOff: "🔕 Activar sonido",
    live: "● En vivo",
  },
  caja: {
    toCharge: "{amount} por cobrar",
    claimed1: "🔔 {n} pago por confirmar",
    claimedN: "🔔 {n} pagos por confirmar",
    colTable: "Mesa / pedido",
    colTotal: "Total",
    colState: "Estado de cobro",
    colAction: "Acción",
    noOpen: "No hay cuentas abiertas 🎉",
    items: "{n} ítems",
    claimedChip: "Pago informado",
    toChargeChip: "Por cobrar",
    confirm: "Confirmar pago ✓",
    charge: "Cobrar",
    cancel: "Cancelar",
    paidToday: "Cobrados hoy",
    revert: "Deshacer",
    changeMethod: "Cambiar método",
    verifyTitle: "Comprobar pago",
    proofTitle: "Captura del cliente",
    noProof: "Sin captura — pídele ver el celular",
    viewProof: "Ver captura",
    opNumber: "N.º de operación",
    opNumberPh: "Ej. 15857647",
    amountReceived: "Monto recibido",
    tip: "Propina",
  },
  salon: {
    free: "Libre",
    closed: "Cuenta cerrada",
    pending: "Pedido nuevo",
    preparing: "En cocina",
    ready: "Listo para servir",
    claimed: "Pago informado",
    tocharge: "Por cobrar",
    occupied1: "{n} ocupada",
    occupiedN: "{n} ocupadas",
    free1: "{n} libre",
    freeN: "{n} libres",
    unpaid: "{amount} sin cobrar",
    noTables: "Este local todavía no tiene mesas. Se crean en Admin → Mesas & QR.",
    extra1: "+{n} pedido",
    extraN: "+{n} pedidos",
    paidAt: "Pagó a las {h}",
    freeTable: "Liberar mesa",
    freeing: "Liberando…",
  },
  admin: {
    role: "Admin",
    tabs: {
      menu: "Carta",
      mesas: "Mesas & QR",
      cobros: "Cobros y seguridad",
      marca: "Marca & local",
    },
    counts: "{items} platos · {cats} categorías",
    menuHint:
      "Toca el interruptor para marcar un plato como agotado. Se refleja al instante en el menú del cliente.",
    addItem: "Agregar producto",
    category: "Categoría…",
    itemName: "Nombre del plato",
    price: "Precio",
    newItem: "+ Nuevo plato",
    newCategoryPh: "Nueva categoría (ej. Menú del día)",
    createCategory: "Crear categoría",
    photo: "📷 Foto",
    changePhoto: "📷 Cambiar",
    editPrice: "Editar precio",
    delete: "Eliminar",
    available: "Disponible",
    soldout: "Agotado",
    pricePrompt: 'Nuevo precio de "{name}" (ej. 35.50):',
    deleteConfirm: '¿Eliminar "{name}" del menú?',
    uploading: "Subiendo…",
    uploadFail: "No se pudo subir la imagen",
    saveFail: "No se pudo guardar",
    tablesHint:
      "Imprime cada QR y pégalo en su mesa. Al escanearlo, el cliente entra directo al menú de esa mesa.",
    tableNo: "N° de mesa",
    createTable: "Crear mesa",
    generatingQr: "Generando QR…",
    downloadPng: "Descargar PNG",
    brandHint:
      "Esto es lo que ve tu cliente al escanear el QR: tu logo, tu portada y tu color. Un solo token re-tematiza todo el producto.",
    logoCover: "Logo y portada",
    noLogo: "Sin logo",
    changeLogo: "📷 Cambiar logo",
    uploadLogo: "📷 Subir logo",
    noCover: "Sin foto de portada",
    changeCover: "📷 Cambiar portada",
    uploadCover: "📷 Subir portada",
    brandColor: "Color de marca",
    colorHint: "Un token re-tematiza todo el producto. El contraste del texto se calcula solo.",
    serviceMode: "Modo de servicio",
    serviceModeHint:
      "Define cómo trabaja el local y qué pantallas usa. Se guarda al tocar una opción.",
    modes: {
      salon: {
        name: "Salón",
        desc: "Mesas con QR y mozos. El cliente pide desde su mesa y le llevan el plato.",
      },
      despacho: {
        name: "Despacho",
        desc: "Sin mesas ni mozos: se pide en el mostrador y se recoge cuando la cocina llama.",
      },
      mixto: {
        name: "Mixto",
        desc: "Mesas con QR y además pedidos de mostrador para llevar, en la misma caja.",
      },
    },
    other: "Otro:",
    current: "Actual:",
    saveColor: "Guardar color",
    saved: "Guardado ✓",
    payTitle: "Cobros digitales",
    payHint:
      "Con esto tus clientes pagan desde su celular apenas piden: ven tu QR, yapean y avisan; la caja solo confirma.",
    yapeNumber: "Número Yape",
    plinNumber: "Número Plin",
    staffPin: "PIN del personal · cocina y caja (4–6 dígitos)",
    adminPin: "PIN del dueño · esta pantalla (4–6 dígitos)",
    pinWarn:
      "Ponle uno distinto al del personal: con este PIN se cambian los precios y el número de Yape al que llega tu dinero.",
    keepPin: "Dejar vacío para no cambiar",
    saveChanges: "Guardar cambios",
    payQr: "QR de cobro",
    payQrHint:
      "Sube la imagen del QR que te da tu app de Yape o Plin. Es lo que verá el cliente al pagar.",
    noPayQr: "Sin QR de cobro",
    changeQr: "📷 Cambiar QR",
    uploadQr: "📷 Subir QR de cobro",
  },
};

const en: Dict = {
  despacho: {
    preparing: "Being prepared",
    ready: "Ready — pick up",
    empty: "No orders right now.",
  },
  nav: { cocina: "Kitchen", caja: "Cashier", salon: "Floor", admin: "Admin", despacho: "Pickup board" },
  common: { loading: "Loading…", offline: "Offline", min: "min", table: "Table {n}" },
  status: {
    pending: "Received",
    preparing: "Being prepared",
    ready: "Ready to serve",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },
  hint: {
    pending: "The kitchen has seen your order.",
    preparing: "They're cooking your food.",
    ready: "On its way to your table.",
    delivered: "Enjoy your meal!",
    cancelled: "Please ask the staff.",
  },
  pay: {
    yape: { label: "Yape", desc: "Pay now from your phone" },
    plin: { label: "Plin", desc: "Pay now from your phone" },
    card: { label: "Card", desc: "Card reader at the table (Visa, Mastercard, Amex)" },
    cash: { label: "Cash", desc: "Pay the staff in cash" },
  },
  gate: {
    checking: "Checking access…",
    staffPrompt: "Enter the staff PIN to continue",
    adminPrompt: "Enter the owner PIN to continue",
    enter: "Enter",
    verifying: "Checking…",
    wrongPin: "Wrong PIN",
    notAdmin: "That PIN doesn't open Admin. Use the owner's.",
    connError: "Connection error",
    staffHint: "No PIN? Ask the restaurant's administrator.",
    adminHint: "Change the owner PIN in Admin → Payments & security.",
  },
  landing: {
    eyebrow: "Vectaryx",
    h1: "Your restaurant's operating system.",
    lead: "Diners order from their table. The kitchen sees it instantly. The till balances itself. No paper tickets, no app to install, no delivery commissions.",
    ctaDemo: "See how it works",
    ctaTalk: "I want Vectaryx in my place",
    featuresTitle: "What it does",
    f1t: "Diners order without waiting for a waiter",
    f1d: "They scan the QR on their table and there's your menu, with photos. They order and pay from their phone.",
    f2t: "The kitchen sees it instantly",
    f2d: "The ticket lands on the pass screen on its own, with a timer. Nobody runs around with slips of paper.",
    f3t: "The till charges and balances",
    f3d: "Yape, Plin, card or cash. At closing, the day's takings are right there — no adding up by hand.",
    f4t: "The floor, at a glance",
    f4d: "Which table ordered, which is waiting, which needs charging. The colour says it all.",
    f5t: "Every screen in its own language",
    f5d: "Spanish, English and Chinese. The kitchen can be in Chinese while the till is in Spanish, at the same time.",
    forWhoTitle: "For any place that serves food",
    forWhoLead: "The same system, from the simplest to the most complete. You pay for what you use.",
    smallT: "The corner lunch spot",
    smallD: "One menu, one kitchen, one till. Nothing else to learn.",
    midT: "The ceviche house, the chifa",
    midD: "QR tables, waiters, floor map and end-of-day close.",
    bigT: "The formal restaurant",
    bigD: "All of the above, plus what's coming: e-invoicing, reports and inventory.",
    soonTitle: "Still being built.",
    soonText:
      "What's above works today. The payment gateway, tax e-invoicing and inventory are on the way. If you'd like to come in as a pilot, let's talk.",
    footer: "Vectaryx · Orders, kitchen and till for places that serve food · Lima, Peru",
  },
  hub: {
    staffTitle: "Staff",
    ownerTitle: "Owner",
    dinerTitle: "The diner",
    cocinaHint: "Tickets on the pass",
    cajaHint: "Payments and today's takings",
    salonHint: "The tables in the room",
    adminHint: "Menu, brand, tables and payments",
    despachoHint: "The number board for the counter TV.",
    dinerHint: "What someone scanning a table's QR sees.",
    counterLink: "Order at the counter",
    counterHint: "The venue's single QR, no table.",
    seeMenu: "See the menu",
    installTitle: "Install it on the tablet",
    installText:
      "Add this screen to the home screen and it will open on its own, full screen, with no browser bar.",
    notFound: "This restaurant doesn't exist.",
  },
  home: {
    demo: "Vectaryx · demo",
    h1: "Your restaurant takes its own orders.",
    lead: "Diners scan the QR on their table and order from their phone. The order lands straight on the kitchen screen, and the cashier charges via Yape, Plin, card or cash. No app to install, no delivery commissions.",
    twoRestaurants: "Two restaurants, one app",
    orderHere: "🍽️ Order as a diner · start here",
    pinHint: "PIN 1234",
    platform: "Platform (operator) →",
    platformText:
      "Onboarding, monthly billing and suspension. This is the panel Vectaryx charges with. It needs the private key.",
    liveTitle: "See it live:",
    liveText:
      "open the diner view on your phone and the kitchen view on another screen. The order shows up in the kitchen in under 3 seconds, and reporting the payment lights up the cashier.",
    fakeLead: "The Yape and Plin numbers are",
    fake: "fake",
    demoWarn:
      ": this is a demo, don't transfer money. Any orders you leave are wiped when the demo restarts.",
  },
  menu: {
    loading: "Loading menu…",
    loadError: "Couldn't load the menu",
    search: "Search a dish…",
    noResults: "We couldn't find that dish.",
    allCats: "All",
    closed: "We're not taking digital orders right now. Please ask the staff for a menu.",
    soldout: "Sold out",
    soldoutBadge: "SOLD OUT",
    add: "Add",
    viewOrder: "View order",
    yourOrder: "Your order",
    counterBadge: "For pickup",
    counterName: "Under what name?",
    counterNamePh: "Your name (so we can call you)",
    notes: "Notes for the kitchen",
    notesPh: "e.g. no onion, medium rare…",
    howPay: "How are you paying?",
    send: "Send order",
    sending: "Sending to the kitchen…",
    sendError: "Couldn't send the order",
    payInApp: "After you send the order you'll get the QR to pay from your phone.",
    payLater: "You pay at the venue when you're done. Your order goes straight to the kitchen.",
    openOrder: "You have an order in progress",
    waitingCaja: "Waiting for the cashier to confirm your payment",
    see: "View →",
  },
  track: {
    loading: "Loading order…",
    orderNo: "Order #{n}",
    currentStatus: "Current status",
    inProgress: "In progress…",
    demoWarn: "⚠️ Demo — the number below is fake. Don't transfer money.",
    payWith: "Pay with {m}",
    payScanPre: "Scan the QR or use the number, transfer ",
    payPre: "Transfer ",
    payPost: " and confirm.",
    qrAlt: "{m} payment QR",
    holder: "Account holder",
    iPaid: "I've paid",
    claiming: "Letting them know…",
    payProofPrompt: "📸 Upload your payment screenshot",
    payProofHint: "Helps the cashier confirm faster",
    payProofReading: "Preparing your screenshot…",
    payProofReady: "Screenshot ready",
    payProofChange: "Tap to change it",
    claimedTitle: "Payment reported",
    claimedPre: "We told the cashier. As soon as they confirm the transfer you'll see it as ",
    paidWord: "Paid",
    claimedPost: ".",
    waitingCaja: "Waiting for the cashier to confirm",
    paidWith: "Payment confirmed with {m} ✓ Thank you!",
    payAtVenue: "Pay at the venue",
    payAtVenueWith: "Paying with {m}",
    chargedAtTable: "Charged at the table · total {amount}",
    total: "Total",
    orderMore: "Order something else",
    autoRefresh: "This page refreshes itself every few seconds.",
    readyTitle: "Your order is ready!",
    readyTab: "🔔 Ready!",
  },
  kitchen: {
    cols: { pending: "Received", preparing: "Cooking", ready: "Ready" },
    next: { pending: "Start cooking", preparing: "Mark ready", ready: "Hand over" },
    done: "Delivered today",
    empty: "No tickets",
    noneDone: "Nothing delivered yet",
    cancel: "Void",
    backToReady: "↩ Back to ready",
    soundOn: "🔔 Sound on",
    soundOff: "🔕 Turn on sound",
    live: "● Live",
  },
  caja: {
    toCharge: "{amount} to collect",
    claimed1: "🔔 {n} payment to confirm",
    claimedN: "🔔 {n} payments to confirm",
    colTable: "Table / order",
    colTotal: "Total",
    colState: "Payment status",
    colAction: "Action",
    noOpen: "No open bills 🎉",
    items: "{n} items",
    claimedChip: "Payment reported",
    toChargeChip: "To collect",
    confirm: "Confirm payment ✓",
    charge: "Collect",
    cancel: "Cancel",
    paidToday: "Collected today",
    revert: "Undo",
    changeMethod: "Change method",
    verifyTitle: "Check payment",
    proofTitle: "Customer's screenshot",
    noProof: "No screenshot — ask to see the phone",
    viewProof: "View screenshot",
    opNumber: "Operation no.",
    opNumberPh: "e.g. 15857647",
    amountReceived: "Amount received",
    tip: "Tip",
  },
  salon: {
    free: "Free",
    closed: "Bill settled",
    pending: "New order",
    preparing: "In the kitchen",
    ready: "Ready to serve",
    claimed: "Payment reported",
    tocharge: "To collect",
    occupied1: "{n} taken",
    occupiedN: "{n} taken",
    free1: "{n} free",
    freeN: "{n} free",
    unpaid: "{amount} uncollected",
    noTables: "This venue has no tables yet. Create them in Admin → Tables & QR.",
    extra1: "+{n} order",
    extraN: "+{n} orders",
    paidAt: "Paid at {h}",
    freeTable: "Clear table",
    freeing: "Clearing…",
  },
  admin: {
    role: "Admin",
    tabs: {
      menu: "Menu",
      mesas: "Tables & QR",
      cobros: "Payments & security",
      marca: "Brand & venue",
    },
    counts: "{items} dishes · {cats} categories",
    menuHint:
      "Flip the switch to mark a dish as sold out. It shows up instantly on the diner's menu.",
    addItem: "Add a product",
    category: "Category…",
    itemName: "Dish name",
    price: "Price",
    newItem: "+ New dish",
    newCategoryPh: "New category (e.g. Set menu)",
    createCategory: "Create category",
    photo: "📷 Photo",
    changePhoto: "📷 Change",
    editPrice: "Edit price",
    delete: "Delete",
    available: "Available",
    soldout: "Sold out",
    pricePrompt: 'New price for "{name}" (e.g. 35.50):',
    deleteConfirm: 'Delete "{name}" from the menu?',
    uploading: "Uploading…",
    uploadFail: "Couldn't upload the image",
    saveFail: "Couldn't save",
    tablesHint:
      "Print each QR and stick it on its table. Scanning it takes the diner straight to that table's menu.",
    tableNo: "Table no.",
    createTable: "Create table",
    generatingQr: "Generating QR…",
    downloadPng: "Download PNG",
    brandHint:
      "This is what your diner sees after scanning the QR: your logo, your cover and your colour. A single token re-themes the whole product.",
    logoCover: "Logo and cover",
    noLogo: "No logo",
    changeLogo: "📷 Change logo",
    uploadLogo: "📷 Upload logo",
    noCover: "No cover photo",
    changeCover: "📷 Change cover",
    uploadCover: "📷 Upload cover",
    brandColor: "Brand colour",
    colorHint: "One token re-themes the whole product. Text contrast is worked out for you.",
    serviceMode: "Service mode",
    serviceModeHint:
      "Sets how the venue works and which screens it uses. Saved as soon as you pick one.",
    modes: {
      salon: {
        name: "Dining room",
        desc: "QR tables and waiters. Guests order from their table and the dish is brought over.",
      },
      despacho: {
        name: "Counter",
        desc: "No tables, no waiters: order at the counter and pick up when the kitchen calls.",
      },
      mixto: {
        name: "Mixed",
        desc: "QR tables plus counter takeaway orders, all through the same till.",
      },
    },
    other: "Other:",
    current: "Current:",
    saveColor: "Save colour",
    saved: "Saved ✓",
    payTitle: "Digital payments",
    payHint:
      "With this your diners pay from their phone the moment they order: they see your QR, transfer and report it; the cashier just confirms.",
    yapeNumber: "Yape number",
    plinNumber: "Plin number",
    staffPin: "Staff PIN · kitchen and cashier (4–6 digits)",
    adminPin: "Owner PIN · this screen (4–6 digits)",
    pinWarn:
      "Make it different from the staff one: this PIN changes prices and the Yape number your money lands in.",
    keepPin: "Leave empty to keep it",
    saveChanges: "Save changes",
    payQr: "Payment QR",
    payQrHint:
      "Upload the QR image your Yape or Plin app gives you. It's what the diner sees when paying.",
    noPayQr: "No payment QR",
    changeQr: "📷 Change QR",
    uploadQr: "📷 Upload payment QR",
  },
};

const zh: Dict = {
  despacho: {
    preparing: "制作中",
    ready: "可自取",
    empty: "暂无订单。",
  },
  nav: { cocina: "后厨", caja: "收银", salon: "餐厅大堂", admin: "管理后台", despacho: "取餐屏" },
  common: { loading: "加载中…", offline: "已断线", min: "分钟", table: "{n} 号桌" },
  status: {
    pending: "已接单",
    preparing: "制作中",
    ready: "可上菜",
    delivered: "已上菜",
    cancelled: "已取消",
  },
  hint: {
    pending: "后厨已收到您的订单。",
    preparing: "正在为您烹饪。",
    ready: "菜品正在送往您的餐桌。",
    delivered: "请慢用！",
    cancelled: "请联系店内工作人员。",
  },
  pay: {
    yape: { label: "Yape", desc: "立即用手机支付" },
    plin: { label: "Plin", desc: "立即用手机支付" },
    card: { label: "刷卡", desc: "餐桌刷卡机（Visa、Mastercard、Amex）" },
    cash: { label: "现金", desc: "向工作人员付现金" },
  },
  gate: {
    checking: "正在验证权限…",
    staffPrompt: "请输入员工 PIN 码以继续",
    adminPrompt: "请输入店主 PIN 码以继续",
    enter: "进入",
    verifying: "验证中…",
    wrongPin: "PIN 码错误",
    notAdmin: "该 PIN 码无法进入管理后台，请使用店主的 PIN 码。",
    connError: "连接错误",
    staffHint: "没有 PIN 码？请向餐厅管理员索取。",
    adminHint: "店主 PIN 码可在「管理后台 → 收款与安全」中修改。",
  },
  landing: {
    eyebrow: "Vectaryx",
    h1: "让餐厅自己运转的系统。",
    lead: "客人在餐桌上直接点单，后厨即时收到，收银自动对账。不用手写单据，不用下载 App，也没有外卖平台抽成。",
    ctaDemo: "看看它怎么运作",
    ctaTalk: "我想在我的店里用",
    featuresTitle: "它能做什么",
    f1t: "客人不用等服务员",
    f1d: "扫一扫桌上的二维码，带图片的菜单就在眼前。用手机点单、付款。",
    f2t: "后厨即时看到",
    f2d: "订单自动出现在出餐屏上，还带计时。没人再拿着纸条跑来跑去。",
    f3t: "收银收款、自动对账",
    f3d: "Yape、Plin、刷卡或现金。打烊时，当天的收款一目了然，不用手算。",
    f4t: "大堂一览无余",
    f4d: "哪桌点了单、哪桌在等、哪桌该收钱。看颜色就知道。",
    f5t: "每块屏幕，各说各的语言",
    f5d: "西班牙语、英语、中文。后厨可以是中文，收银同时是西班牙语。",
    forWhoTitle: "适合任何餐饮场所",
    forWhoLead: "同一套系统，从最简单到最完整。用多少，付多少。",
    smallT: "街角的小饭馆",
    smallD: "一份菜单、一个后厨、一台收银。没别的要学。",
    midT: "海鲜餐厅、中餐馆",
    midD: "二维码餐桌、服务员、大堂图和每日结账。",
    bigT: "正规餐厅",
    bigD: "以上全部，加上即将上线的：电子发票、报表和库存。",
    soonTitle: "仍在建设中。",
    soonText:
      "上面这些今天已经可以用了。支付网关、SUNAT 电子发票和库存正在路上。如果想作为试点加入，欢迎聊聊。",
    footer: "Vectaryx · 为餐饮场所打造的点单、后厨与收银系统 · 秘鲁利马",
  },
  hub: {
    staffTitle: "员工",
    ownerTitle: "店主",
    dinerTitle: "客人",
    cocinaHint: "出餐口的订单",
    cajaHint: "收款与当日账目",
    salonHint: "店内的餐桌",
    adminHint: "菜单、品牌、餐桌与收款",
    despachoHint: "柜台电视上的取餐叫号屏。",
    dinerHint: "扫描餐桌二维码的人看到的画面。",
    counterLink: "在柜台点餐",
    counterHint: "店铺的唯一二维码，无需餐桌。",
    seeMenu: "查看菜单",
    installTitle: "装到平板上",
    installText: "把这个页面添加到主屏幕，它就会独立全屏打开，看不到浏览器地址栏。",
    notFound: "该餐厅不存在。",
  },
  home: {
    demo: "Vectaryx · 演示",
    h1: "让餐厅自己接单。",
    lead: "客人扫描餐桌上的二维码，用手机点餐。订单直接出现在后厨屏幕上，收银台用 Yape、Plin、刷卡或现金收款。无需下载 App，也没有外卖平台抽成。",
    twoRestaurants: "两家餐厅，同一套系统",
    orderHere: "🍽️ 以客人身份点餐 · 从这里开始",
    pinHint: "PIN 码 1234",
    platform: "平台端（运营方）→",
    platformText: "开通餐厅、按月收费与停用。这是 Vectaryx 用来收费的后台，需要私钥。",
    liveTitle: "如何实时体验：",
    liveText:
      "用手机打开客人视图，用另一块屏幕打开后厨视图。下单后 3 秒内后厨即可看到；点击「我已付款」，收银台随即亮起。",
    fakeLead: "Yape 和 Plin 的号码都是",
    fake: "虚构的",
    demoWarn: "：这是演示，请勿转账。演示重启后，您留下的订单会被清除。",
  },
  menu: {
    loading: "菜单加载中…",
    loadError: "菜单加载失败",
    search: "搜索菜品…",
    noResults: "没有找到这道菜。",
    allCats: "全部",
    closed: "目前暂不接受线上点餐，请向店内工作人员索取菜单。",
    soldout: "已售罄",
    soldoutBadge: "已售罄",
    add: "加入",
    viewOrder: "查看订单",
    yourOrder: "您的订单",
    counterBadge: "自取",
    counterName: "用什么名字？",
    counterNamePh: "您的名字（方便叫号）",
    notes: "给后厨的备注",
    notesPh: "例如：不要洋葱、几分熟…",
    howPay: "如何付款？",
    send: "提交订单",
    sending: "正在送往后厨…",
    sendError: "订单提交失败",
    payInApp: "提交订单后，会显示二维码供您用手机付款。",
    payLater: "用餐结束后在店内付款。您的订单会直接送到后厨。",
    openOrder: "您有一份进行中的订单",
    waitingCaja: "等待收银台确认您的付款",
    see: "查看 →",
  },
  track: {
    loading: "订单加载中…",
    orderNo: "订单 #{n}",
    currentStatus: "当前状态",
    inProgress: "进行中…",
    demoWarn: "⚠️ 演示 — 下方号码为虚构，请勿转账。",
    payWith: "使用 {m} 付款",
    payScanPre: "扫描二维码或使用手机号，转账 ",
    payPre: "转账 ",
    payPost: " 后点击确认。",
    qrAlt: "{m} 收款二维码",
    holder: "收款人",
    iPaid: "我已付款",
    claiming: "正在通知…",
    payProofPrompt: "📸 上传付款截图",
    payProofHint: "帮助收银更快确认",
    payProofReading: "正在准备截图…",
    payProofReady: "截图已就绪",
    payProofChange: "点击更换",
    claimedTitle: "已告知付款",
    claimedPre: "我们已通知收银台。他们确认到账后，状态会变为",
    paidWord: "已付款",
    claimedPost: "。",
    waitingCaja: "等待收银台确认",
    paidWith: "已通过 {m} 确认付款 ✓ 谢谢惠顾！",
    payAtVenue: "在店内付款",
    payAtVenueWith: "使用 {m} 付款",
    chargedAtTable: "在餐桌收款 · 合计 {amount}",
    total: "合计",
    orderMore: "再点一些",
    autoRefresh: "本页面每隔几秒自动刷新。",
    readyTitle: "您的订单已做好！",
    readyTab: "🔔 已做好！",
  },
  kitchen: {
    cols: { pending: "已接单", preparing: "制作中", ready: "已做好" },
    next: { pending: "开始制作", preparing: "标记做好", ready: "上菜" },
    done: "今日已上菜",
    empty: "暂无订单",
    noneDone: "今天还没有上菜",
    cancel: "作废",
    backToReady: "↩ 退回「已做好」",
    soundOn: "🔔 提示音已开",
    soundOff: "🔕 开启提示音",
    live: "● 实时",
  },
  caja: {
    toCharge: "待收 {amount}",
    claimed1: "🔔 {n} 笔付款待确认",
    claimedN: "🔔 {n} 笔付款待确认",
    colTable: "餐桌 / 订单",
    colTotal: "合计",
    colState: "收款状态",
    colAction: "操作",
    noOpen: "没有未结账的订单 🎉",
    items: "{n} 份",
    claimedChip: "已告知付款",
    toChargeChip: "待收款",
    confirm: "确认收款 ✓",
    charge: "收款",
    cancel: "取消",
    paidToday: "今日已收款",
    revert: "撤销",
    changeMethod: "更改方式",
    verifyTitle: "核对付款",
    proofTitle: "客户的截图",
    noProof: "无截图 — 请查看手机",
    viewProof: "查看截图",
    opNumber: "操作号",
    opNumberPh: "如 15857647",
    amountReceived: "收到金额",
    tip: "小费",
  },
  salon: {
    free: "空桌",
    closed: "已结账",
    pending: "新订单",
    preparing: "后厨制作中",
    ready: "可上菜",
    claimed: "已告知付款",
    tocharge: "待收款",
    occupied1: "{n} 桌有客",
    occupiedN: "{n} 桌有客",
    free1: "{n} 桌空闲",
    freeN: "{n} 桌空闲",
    unpaid: "待收 {amount}",
    noTables: "本店尚未设置餐桌。请在「管理后台 → 餐桌与二维码」中创建。",
    extra1: "+{n} 单",
    extraN: "+{n} 单",
    paidAt: "{h} 已付款",
    freeTable: "清台",
    freeing: "清台中…",
  },
  admin: {
    role: "管理员",
    tabs: {
      menu: "菜单",
      mesas: "餐桌与二维码",
      cobros: "收款与安全",
      marca: "品牌与门店",
    },
    counts: "{items} 道菜 · {cats} 个分类",
    menuHint: "点击开关即可把菜品标记为售罄，客人菜单上会立即生效。",
    addItem: "添加菜品",
    category: "分类…",
    itemName: "菜品名称",
    price: "价格",
    newItem: "+ 新菜品",
    newCategoryPh: "新分类（例如：今日套餐）",
    createCategory: "创建分类",
    photo: "📷 照片",
    changePhoto: "📷 更换",
    editPrice: "修改价格",
    delete: "删除",
    available: "可点",
    soldout: "已售罄",
    pricePrompt: "「{name}」的新价格（例如 35.50）：",
    deleteConfirm: "确定要从菜单中删除「{name}」吗？",
    uploading: "上传中…",
    uploadFail: "图片上传失败",
    saveFail: "保存失败",
    tablesHint: "打印每张二维码并贴在对应的餐桌上。客人扫码后会直接进入该桌的菜单。",
    tableNo: "桌号",
    createTable: "创建餐桌",
    generatingQr: "正在生成二维码…",
    downloadPng: "下载 PNG",
    brandHint:
      "这是客人扫码后看到的一切：您的标志、封面和主色。一个色值即可重塑整个产品的外观。",
    logoCover: "标志与封面",
    noLogo: "暂无标志",
    changeLogo: "📷 更换标志",
    uploadLogo: "📷 上传标志",
    noCover: "暂无封面图",
    changeCover: "📷 更换封面",
    uploadCover: "📷 上传封面",
    brandColor: "品牌主色",
    colorHint: "一个色值即可重塑整个产品，文字对比度会自动计算。",
    serviceMode: "服务模式",
    serviceModeHint: "决定店铺的运营方式和使用的界面。点击选项即保存。",
    modes: {
      salon: {
        name: "堂食",
        desc: "带二维码的餐桌和服务员。顾客在餐桌点餐，由服务员送菜。",
      },
      despacho: {
        name: "自取",
        desc: "无餐桌无服务员：在柜台点餐，厨房叫号后自取。",
      },
      mixto: {
        name: "混合",
        desc: "既有二维码餐桌，也支持柜台外带下单，统一收银。",
      },
    },
    other: "其他：",
    current: "当前：",
    saveColor: "保存主色",
    saved: "已保存 ✓",
    payTitle: "线上收款",
    payHint:
      "开启后，客人点餐时即可用手机付款：看到您的二维码，转账并告知；收银台只需确认。",
    yapeNumber: "Yape 号码",
    plinNumber: "Plin 号码",
    staffPin: "员工 PIN 码 · 后厨与收银（4–6 位数字）",
    adminPin: "店主 PIN 码 · 本页面（4–6 位数字）",
    pinWarn:
      "请设置成与员工 PIN 码不同：用这个 PIN 码可以修改价格，以及收款用的 Yape 号码。",
    keepPin: "留空则不修改",
    saveChanges: "保存修改",
    payQr: "收款二维码",
    payQrHint: "上传 Yape 或 Plin 应用生成的收款二维码图片，客人付款时会看到它。",
    noPayQr: "暂无收款二维码",
    changeQr: "📷 更换二维码",
    uploadQr: "📷 上传收款二维码",
  },
};

export const DICTS: Record<Lang, Dict> = { es, en, zh };

/** El diccionario de la pantalla: `const [t, lang, setLang] = useT("cocina")`. */
export function useT(surface: Surface): [Dict, Lang, (l: Lang) => void] {
  const [lang, setLang] = useLang(surface);
  return [DICTS[lang], lang, setLang];
}
