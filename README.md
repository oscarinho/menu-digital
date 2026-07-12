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

Abre http://localhost:3000. La primera vez se crea `data/menu.db` (SQLite) con
un restaurante demo: **La Cevichería del Puerto** (slug `demo`, 8 mesas, menú
peruano de ejemplo).

**Credenciales demo**: PIN del personal `1234` · PIN del dueño `1234` (en un local
real deben ser distintos) · clave de plataforma `vectaryx2026`. En producción hay
que cambiarla con `VECTARYX_PLATFORM_KEY`: sin ella, el panel `/plataforma` no
arranca (antes caía en la clave pública de la demo).

**Estructura**: `src/` la app · `scripts/` utilidades de línea de comandos ·
`demo/` el snapshot de la demo pública · `docs/` las guías (despliegue, pruebas,
demo, revisión técnica) · `ops/` material de trabajo que no es parte del producto
(prompts de imágenes, arte generado, la carta en PDF).

## Superficies

| Ruta | Quién la usa |
| --- | --- |
| `/r/demo/mesa/1` | Cliente: menú con fotos, carrito y envío del pedido (abrir en el celular) |
| `/pedido/[id]` | Cliente: tracking en vivo + pago Yape/Plin ("Ya pagué ✓") |
| `/cocina/demo` | Cocina (KDS): Nuevos → En preparación → Listos, con alerta sonora opcional. Requiere PIN |
| `/caja/demo` | Caja: cuentas por mesa, confirmación de pagos Yape/Plin informados por el cliente, cobro con tarjeta/efectivo. Requiere PIN |
| `/admin/demo` | Administración: menú (fotos, precios, disponibilidad), mesas con QR imprimible, datos de cobro (números Yape/Plin, QR de pago, cambio de PIN). Requiere PIN |
| `/plataforma` | Operador Vectaryx: alta de restaurantes, mensualidad, métricas del día, suspender/reactivar. Requiere clave de plataforma |

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
