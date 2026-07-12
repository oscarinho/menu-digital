// Catálogo de arte GENÉRICO de la plataforma multi-tenant Vectaryx
// (no de un restaurante puntual): íconos de categoría, ilustraciones de
// estados vacíos, banners por tipo de cocina, placeholders, íconos de pago
// y marca. Exporta un CSV completo + CSV por ronda de 10 para generar en lote.
// Uso: node scripts/export-arte-app-csv.mjs

import fs from "fs";
import path from "path";

const CHUNK = 10;
// Los CSV son material de trabajo, no del producto: viven en ops/, fuera de la raíz.
const OUT_DIR = path.join(process.cwd(), "ops", "prompts-imagenes");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "vectaryx-arte.csv");

// Plantillas de estilo por tipo de arte (mantienen todo el set coherente).
const STYLE = {
  // Íconos UI: monocromo para poder teñirlos con el color de marca del tenant.
  ICON:
    "Ícono vectorial plano y minimalista, trazo de grosor uniforme, un solo color tinta gris pizarra sobre fondo transparente (pensado para teñirse con el color de marca de cada restaurante), esquinas suaves, sin texto, sin sombras ni degradados, legible a 24 px.",
  // Ilustraciones (estados vacíos, onboarding): amigables y neutrales.
  ILUS:
    "Ilustración plana moderna, amigable y limpia, estilo editorial de app, paleta neutra suave con un único acento, formas simples, mucho aire, composición centrada, fondo claro, sin texto, sin logotipos ni marcas.",
  // Fotos (banners por tipo de cocina, placeholders foto-realistas).
  FOTO:
    "Fotografía gastronómica apetitosa y luminosa, luz natural, alta definición, encuadre editorial, sin texto, sin personas identificables, sin logotipos ni marcas de agua.",
  // Identidad de la plataforma Vectaryx.
  MARCA:
    "Identidad visual para una app tecnológica de restaurantes (menú digital y pedidos): símbolo geométrico limpio, moderno, memorable y escalable, paleta sobria, fondo simple, sin texto salvo que se indique.",
};

// [filename (sin extensión), sujeto, formato, claveEstilo]
const ART = [
  // ── Marca / plataforma ──
  ["vectaryx_app-icon", "Ícono de la app Vectaryx: símbolo que fusiona sutilmente un plato/mesa con una señal digital o un código QR", "1:1", "MARCA"],
  ["vectaryx_logo-simbolo", "Símbolo de marca Vectaryx aislado, limpio y escalable, para cabeceras", "1:1", "MARCA"],
  ["vectaryx_hero-landing", "Ilustración hero para la landing: un comensal en la mesa escanea el QR con el celular y ve el menú digital", "16:9", "ILUS"],
  ["vectaryx_onboarding-escanear", "Ilustración de onboarding: escanear el código QR de la mesa con el celular", "1:1", "ILUS"],
  ["vectaryx_onboarding-pedir", "Ilustración de onboarding: elegir platos en el menú del celular y armar el pedido", "1:1", "ILUS"],
  ["vectaryx_onboarding-pagar", "Ilustración de onboarding: pagar el pedido desde el celular con billetera digital", "1:1", "ILUS"],

  // ── Íconos de categoría (cubren cualquier tipo de restaurante) ──
  ["vectaryx_cat-ceviches", "Ícono de categoría Ceviches y pescados: pez con una rodaja de limón", "1:1", "ICON"],
  ["vectaryx_cat-piqueos", "Ícono de categoría Piqueos y entradas: tabla de bocaditos para compartir", "1:1", "ICON"],
  ["vectaryx_cat-sopas", "Ícono de categoría Sopas y caldos: plato hondo humeante con cuchara", "1:1", "ICON"],
  ["vectaryx_cat-causas", "Ícono de categoría Causas: molde de causa peruana en capas", "1:1", "ICON"],
  ["vectaryx_cat-arroces", "Ícono de categoría Arroces y tacu tacus: tazón de arroz", "1:1", "ICON"],
  ["vectaryx_cat-pastas", "Ícono de categoría Pastas: plato de spaghetti con tenedor enrollando", "1:1", "ICON"],
  ["vectaryx_cat-parrilla", "Ícono de categoría Parrilla y carnes: corte de carne a la parrilla", "1:1", "ICON"],
  ["vectaryx_cat-pollo-brasa", "Ícono de categoría Pollo a la brasa: cuarto de pollo con papas", "1:1", "ICON"],
  ["vectaryx_cat-chifa", "Ícono de categoría Chifa y wok: sartén wok con palitos chinos", "1:1", "ICON"],
  ["vectaryx_cat-pizzas", "Ícono de categoría Pizzas: porción de pizza triangular", "1:1", "ICON"],
  ["vectaryx_cat-hamburguesas", "Ícono de categoría Hamburguesas: hamburguesa en capas", "1:1", "ICON"],
  ["vectaryx_cat-sanduches", "Ícono de categoría Sánguches: sándwich en diagonal", "1:1", "ICON"],
  ["vectaryx_cat-ensaladas", "Ícono de categoría Ensaladas: bowl con hojas verdes", "1:1", "ICON"],
  ["vectaryx_cat-mariscos", "Ícono de categoría Mariscos: langostino o concha", "1:1", "ICON"],
  ["vectaryx_cat-postres", "Ícono de categoría Postres: porción de torta con cereza", "1:1", "ICON"],
  ["vectaryx_cat-bebidas", "Ícono de categoría Bebidas: vaso con sorbete y rodaja", "1:1", "ICON"],
  ["vectaryx_cat-cocteles", "Ícono de categoría Cócteles y piscos: copa de cóctel", "1:1", "ICON"],
  ["vectaryx_cat-cafe", "Ícono de categoría Cafetería: taza de café humeante", "1:1", "ICON"],
  ["vectaryx_cat-desayunos", "Ícono de categoría Desayunos: huevo frito con pan", "1:1", "ICON"],
  ["vectaryx_cat-kids", "Ícono de categoría Menú infantil: carita con globo o juguete", "1:1", "ICON"],
  ["vectaryx_cat-vegetariano", "Ícono de categoría Vegetariano: hoja o brote", "1:1", "ICON"],
  ["vectaryx_cat-sushi", "Ícono de categoría Sushi y nikkei: pieza de sushi con palitos", "1:1", "ICON"],
  ["vectaryx_cat-mexicano", "Ícono de categoría Mexicano: taco doblado", "1:1", "ICON"],
  ["vectaryx_cat-extras", "Ícono de categoría Extras y guarniciones: porción de papas/complemento", "1:1", "ICON"],

  // ── Estados vacíos / ilustraciones de UI ──
  ["vectaryx_estado-carrito-vacio", "Ilustración de estado vacío: carrito de pedido vacío, tono amable", "1:1", "ILUS"],
  ["vectaryx_estado-pedido-enviado", "Ilustración de éxito: pedido enviado a cocina, check de confirmación", "1:1", "ILUS"],
  ["vectaryx_estado-pago-exitoso", "Ilustración de éxito: pago realizado correctamente", "1:1", "ILUS"],
  ["vectaryx_estado-cocina-sin-pedidos", "Ilustración de estado vacío: cocina sin comandas pendientes, todo al día", "1:1", "ILUS"],
  ["vectaryx_estado-carta-vacia", "Ilustración de estado vacío: aún no hay platos en la carta", "1:1", "ILUS"],
  ["vectaryx_estado-error", "Ilustración de error amable: algo salió mal, reintentar", "1:1", "ILUS"],
  ["vectaryx_estado-sin-conexion", "Ilustración de sin conexión a internet", "1:1", "ILUS"],
  ["vectaryx_estado-local-en-pausa", "Ilustración: el restaurante no está recibiendo pedidos ahora (en pausa)", "1:1", "ILUS"],
  ["vectaryx_estado-sin-resultados", "Ilustración de búsqueda sin resultados", "1:1", "ILUS"],

  // ── Placeholders de plato (fallback cuando el restaurante no subió foto) ──
  ["vectaryx_placeholder-ceviche", "Placeholder ilustrado de un ceviche genérico, apetitoso pero neutral", "1:1", "ILUS"],
  ["vectaryx_placeholder-fondo", "Placeholder ilustrado de un plato de fondo genérico", "1:1", "ILUS"],
  ["vectaryx_placeholder-bebida", "Placeholder ilustrado de una bebida genérica en vaso", "1:1", "ILUS"],
  ["vectaryx_placeholder-postre", "Placeholder ilustrado de un postre genérico", "1:1", "ILUS"],
  ["vectaryx_placeholder-pizza", "Placeholder ilustrado de una pizza genérica", "1:1", "ILUS"],
  ["vectaryx_placeholder-cafe", "Placeholder ilustrado de una taza de café genérica", "1:1", "ILUS"],
  ["vectaryx_placeholder-generico", "Placeholder ilustrado de un plato genérico con cubiertos", "1:1", "ILUS"],

  // ── Banners/portadas genéricas por tipo de cocina (para tenants sin foto) ──
  ["vectaryx_banner-cevicheria", "Portada de cevichería costeña peruana: mariscos frescos, ambiente marino luminoso", "16:9", "FOTO"],
  ["vectaryx_banner-polleria", "Portada de pollería: pollo a la brasa dorado y papas", "16:9", "FOTO"],
  ["vectaryx_banner-chifa", "Portada de chifa: platos al wok y ambiente oriental cálido", "16:9", "FOTO"],
  ["vectaryx_banner-criollo", "Portada de comida criolla peruana: lomo saltado y arroz, mesa cálida", "16:9", "FOTO"],
  ["vectaryx_banner-pizzeria", "Portada de pizzería: pizza recién horneada, horno de leña al fondo", "16:9", "FOTO"],
  ["vectaryx_banner-cafe-brunch", "Portada de café/brunch: mesa con café, tostadas y luz natural", "16:9", "FOTO"],
  ["vectaryx_banner-parrilla", "Portada de parrilla: cortes a la parrilla con brasas", "16:9", "FOTO"],
  ["vectaryx_banner-comida-rapida", "Portada de comida rápida: hamburguesa y papas, vibrante", "16:9", "FOTO"],
  ["vectaryx_banner-saludable", "Portada de comida saludable: bowls frescos y coloridos", "16:9", "FOTO"],
  ["vectaryx_banner-marino", "Portada marina genérica: fondo de mar y textura costera para cabecera", "16:9", "FOTO"],

  // ── Íconos de pago y de estado de pedido ──
  ["vectaryx_pago-efectivo", "Ícono de pago en efectivo: billetes/monedas", "1:1", "ICON"],
  ["vectaryx_pago-tarjeta", "Ícono de pago con tarjeta: tarjeta de crédito", "1:1", "ICON"],
  ["vectaryx_pago-qr", "Ícono de pago con QR genérico (billetera digital, sin marca)", "1:1", "ICON"],
  ["vectaryx_estado-recibido", "Ícono de estado Pedido recibido: ticket/campana", "1:1", "ICON"],
  ["vectaryx_estado-preparacion", "Ícono de estado En preparación: gorro de chef/olla", "1:1", "ICON"],
  ["vectaryx_estado-listo", "Ícono de estado Listo para servir: campana de servicio", "1:1", "ICON"],
  ["vectaryx_estado-entregado", "Ícono de estado Entregado: plato servido con check", "1:1", "ICON"],
];

function csvField(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

const HEADER = ["filename", "subject", "format", "prompt"].join(",");
const dataRows = ART.map(([name, subject, format, styleKey]) => {
  const dims = format === "16:9" ? "1792x1024" : "1024x1024";
  const prompt = `SUJETO: ${subject}. ESTILO: ${STYLE[styleKey]} SALIDA: una sola imagen ${format} (${dims}).`;
  return [csvField(name + ".png"), csvField(subject), csvField(format), csvField(prompt)].join(",");
});

fs.writeFileSync(OUT, [HEADER, ...dataRows].join("\n") + "\n", "utf8");

const rondas = Math.ceil(dataRows.length / CHUNK);
for (let i = 0; i < rondas; i++) {
  const slice = dataRows.slice(i * CHUNK, (i + 1) * CHUNK);
  const file = path.join(OUT_DIR, `vectaryx-arte-ronda-${i + 1}.csv`);
  fs.writeFileSync(file, [HEADER, ...slice].join("\n") + "\n", "utf8");
  console.log(`  ronda ${i + 1}: ${slice.length} piezas -> ${path.basename(file)}`);
}
console.log(`OK ${dataRows.length} piezas de arte en ${rondas} rondas (completo: ${path.basename(OUT)})`);
