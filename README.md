# Vectaryx · Pedidos en mesa 🇵🇪

SaaS multitenant de pedidos para restaurantes: el cliente escanea el QR de su
mesa, pide desde su celular (web, sin instalar nada), paga por Yape/Plin desde
el mismo pedido, el pedido llega en vivo a la pantalla de cocina y la caja
confirma los cobros. El operador de la plataforma da de alta restaurantes y les
cobra una mensualidad. Piloto pensado para Perú, con moneda y métodos de pago
configurables por país para abrirse a LATAM.

## Cómo correr

```bash
npm install
npm run dev
```

Abre http://localhost:3000. La portada es el índice de la demo: lleva a las
pantallas de los dos restaurantes, **Punto Azul** (cevichería, slug `punto-azul`)
y **Lanzhou Noodles** (fideos, slug `lanzhou-noodles`). Para partir de una demo
limpia y con las dos cartas cargadas: `npm run demo:reset`.

**Credenciales de la demo**: PIN del personal `1234` · PIN del dueño `1234` (en un
local real deben ser distintos) · clave de plataforma: la que pongas en
`VECTARYX_PLATFORM_KEY`. En producción es obligatoria — sin ella el panel
`/plataforma` no arranca.

Para que otro la pruebe: [docs/GUIA_PRUEBAS.md](docs/GUIA_PRUEBAS.md) es el guion
que se le pasa, y [docs/DEMO.md](docs/DEMO.md) explica cómo publicarla gratis.

**Estructura**: `src/app/` las rutas, agrupadas por quién las usa — `(cliente)`
carta y seguimiento, `(local)` cocina/caja/salón/admin, `(operador)` plataforma
(los paréntesis no cambian las URL) · `src/components/` UI compartida ·
`src/lib/` infraestructura (db, auth, i18n) · `scripts/` utilidades de línea de
comandos · `demo/` el snapshot de la demo pública · `docs/` las guías (el plan
de producto está en [docs/PLAN-ERP.md](docs/PLAN-ERP.md)) · `ops/` material de
trabajo que no es parte del producto (prompts de imágenes, arte generado, la
carta en PDF).

## Superficies

`{slug}` es el del restaurante: `punto-azul` o `lanzhou-noodles` en la demo.

| Ruta | Quién la usa |
| --- | --- |
| `/` | Portada del producto: lo que ve un dueño de restaurante que aún no ha comprado nada |
| `/demo` | Índice de la demo pública, con los dos restaurantes. No es la cara del producto |
| `/{slug}` | **La puerta del local**: su logo, su color y sus pantallas. Lo que el personal abre en la tablet |
| `/{slug}/manifest.webmanifest` | Manifest del local: lo que permite instalarlo como app (icono en `/api/icon/{slug}`) |
| `/r/{slug}/mesa/1` | Cliente: carta con fotos y buscador, carrito y envío del pedido (abrir en el celular) |
| `/pedido/[id]` | Cliente: tracking en vivo + pago Yape/Plin ("Ya pagué ✓") |
| `/cocina/{slug}` | Cocina (KDS): Nuevos → En preparación → Listos, con alerta sonora opcional. Requiere PIN |
| `/caja/{slug}` | Caja: cuentas por mesa, confirmación de pagos Yape/Plin informados por el cliente, cobro con tarjeta/efectivo. Requiere PIN |
| `/salon/{slug}` | Salón: el plano de las mesas, deducido de los pedidos. Requiere PIN |
| `/admin/{slug}` | Administración: menú (fotos, precios, disponibilidad), mesas con QR imprimible, datos de cobro (números Yape/Plin, QR de pago, cambio de PIN). Requiere PIN del dueño |
| `/plataforma` | Operador Vectaryx: alta de restaurantes, mensualidad, métricas del día, suspender/reactivar. Requiere clave de plataforma. **No se enlaza desde ninguna pantalla pública** |

Las cuatro pantallas del personal (cocina, caja, salón, admin) comparten una misma
cabecera (`src/components/StaffShell.tsx`) con la marca del local y navegación entre
ellas: son una aplicación, no cuatro páginas sueltas. Cada local es **instalable**:
manifest e icono propios, y al abrirlo desde el icono no hay barra de navegador.

## Comprobaciones

```bash
npm test     # 25 tests: aislamiento entre locales, día de negocio, flujo del pedido
npm run check  # tipos + lint + tests
```

## Autenticación

- **Dos PINes por restaurante**, de 4-6 dígitos: el del **personal** abre cocina y
  caja; el del **dueño** abre además la administración. Cambiar un precio o el
  número de Yape es redirigir el dinero del local, así que eso no lo puede hacer
  quien solo tiene el PIN de la cocina.
- El login abre una sesión en cookie httpOnly (30 días, `secure` en producción) y
  admite 5 intentos por minuto: reventar un PIN de 4 dígitos pasa de minutos a
  meses.
- Todas las APIs de staff validan que la sesión pertenezca al restaurante objetivo
  (aislamiento entre tenants) y, donde toca, que tenga rol de dueño.
- **Operador de plataforma**: clave única (`VECTARYX_PLATFORM_KEY`) → sesión propia.
  La cookie guarda un token, no la clave, así que una filtración se revoca sin
  rotar el secreto. Controla alta, mensualidad y suspensión de restaurantes.
- Un restaurante suspendido no acepta pedidos (el cliente ve un aviso amable).

## Flujo del pedido

`pending` (recibido) → `preparing` (en cocina) → `ready` (listo) →
`delivered` (entregado). Pago: `unpaid` → `claimed` (el cliente tocó
"Ya pagué" con Yape/Plin) → `paid` (caja confirma que el dinero llegó).
Los precios se guardan en céntimos y se congelan en cada línea del pedido
(snapshot de nombre y precio), así los cambios de menú no alteran pedidos ya
tomados.

## Pagos

`src/lib/payments.ts` define los métodos por país (Perú: Yape y Plin pagan
dentro de la app; tarjeta y efectivo se cobran en mesa). En el tracking del
pedido el cliente ve el número y el QR de cobro del restaurante, transfiere y
marca "Ya pagué"; la caja ve el pago informado resaltado y lo confirma con un
toque. Las pasarelas online (Culqi, Mercado Pago, Izipay) se integran detrás de
esta misma interfaz cuando el piloto lo requiera.

## Fotos del menú

El admin sube fotos (JPEG/PNG/WebP, máx. 4 MB) que se guardan en
`data/uploads/` y se sirven por `/api/images/[nombre]` con validación estricta
del nombre de archivo.

## Multitenant y LATAM

Todo cuelga de un `restaurant` con `slug`, `currency` y `country`. Desde
`/plataforma` se crean restaurantes nuevos (con sus mesas y categorías base) en
segundos, y la moneda se formatea con el locale correcto (`PEN`, `MXN`, `COP`,
`CLP`, `ARS`, `BRL`, `USD`).

## Pendiente para producción

- Migrar SQLite a Postgres si se despliega en Vercel/nube multi-instancia
  (los uploads también deberían ir a un blob storage).
- Integración de pasarela online real y boleta/factura electrónica (SUNAT).
- Cobro automatizado de la mensualidad al restaurante (hoy es manual:
  suspender/reactivar desde `/plataforma`).
- Observabilidad: logging estructurado de errores de API y monitor de uptime.
- Tests automatizados (e2e del flujo crítico y aislamiento multitenant).
- Fase 2: app móvil; hoy el QR de la mesa lleva directo al menú web.

El detalle está en [docs/REVISION-TECNICA.md](docs/REVISION-TECNICA.md), con lo ya
aplicado y lo que queda.
