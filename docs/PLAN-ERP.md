# Vectaryx — de demo a ERP para lugares de comida

Evaluación de todo lo construido hasta hoy (14 jul 2026) y plan para convertirlo
en un producto que sirva **desde el huarique más humilde hasta el restaurante más
completo**. Este documento es el mapa: aquí no se programa nada, se decide qué se
programa y en qué orden.

La regla que ordena todo el plan: **el mismo pedido, la misma cocina y la misma
caja sirven para todos los locales; lo que cambia entre un local humilde y uno
complejo es qué pantallas usa y quién lleva el plato a la mesa.** Eso se llama
*modo de servicio*, hoy no existe en el código, y es la pieza que falta en el
centro.

---

## 1 · Dónde estamos

### Lo que ya funciona (y hay que conservar)

| Módulo | Estado | Dónde vive |
| --- | --- | --- |
| Carta digital con fotos, detalle e ingredientes | ✅ sólido | `/r/[slug]/mesa/[code]` |
| Pedido desde el celular, carrito, notas | ✅ sólido | misma pantalla |
| Seguimiento en vivo del pedido | ✅ (polling) | `/pedido/[id]` |
| Pago Yape/Plin informado por el cliente | ✅ (sin pasarela) | `/pedido/[id]` + caja |
| Cocina (KDS): Nuevos → Preparando → Listos → Entregados hoy | ✅ sólido | `/cocina/[slug]` |
| Caja: confirmar cobros, cobrados hoy, total del día | ✅ sólido | `/caja/[slug]` |
| Salón: estado de las 10 mesas deducido del pedido, liberar mesa | ✅ sólido | `/salon/[slug]` |
| Administración del local: carta, precios, fotos, mesas/QR, cobros, PINes | ✅ con huecos CRUD | `/admin/[slug]` |
| Plataforma (nosotros): alta de locales, mensualidad, suspender | ✅ básico | `/plataforma` |
| Multitenant real (2 locales sembrados, datos aislados) | ✅ verificado a mano | toda la app |
| Idioma por pantalla (ES/EN/中文), incluso en la puerta del PIN | ✅ | `src/lib/i18n.ts` |
| Seguridad P0: PINes con rate-limit, roles staff/admin, migraciones versionadas | ✅ | ver `REVISION-TECNICA.md` |

### Lo que está mal para ser un producto

1. **La app se presenta como demo.** La portada `/` es un índice de dos
   restaurantes de muestra con los PINes publicados. Un producto tiene una
   portada de producto; la demo es una instancia más, no la cara.
2. **Un solo modo de servicio, cableado en todas partes.** Todo pedido nace de
   una mesa (`orders.table_id NOT NULL`), todo local tiene salón, todo plato lo
   lleva alguien a la mesa. El menú del día que atiende por mostrador, la
   sanguchería donde recoges tu pedido cuando gritan tu número — hoy no caben.
3. **El cliente no se entera de nada si no mira la pantalla.** El seguimiento
   se actualiza solo, pero no avisa: ni vibra, ni suena, ni existe una pantalla
   de despacho en el local que diga "Pedido #12 LISTO". Sin eso, el modo sin
   mozos es imposible.
4. **Páginas monolito.** `admin` 985 líneas, `carta` 827, `plataforma` 504:
   cada pantalla es un solo archivo con estado, fetch y UI mezclados. Aguanta
   hoy; no aguanta un ERP.
5. **SQL dentro de las rutas API.** `api/orders/route.ts` (224 líneas) mezcla
   validación, SQL y reglas de negocio. Cuando entren caja con arqueo,
   inventario y facturación, cada regla nueva se escribirá dos veces o se
   olvidará en una.
6. **Cero tests.** El aislamiento entre locales y el día de negocio por zona
   horaria se verificaron a mano. Nada impide romperlos mañana (ya estaba
   señalado en `REVISION-TECNICA.md` como lo primero).
7. **Sin registro de operación de caja.** "Cobrados hoy" existe, pero no hay
   apertura/cierre de caja ni arqueo. Para el dueño de verdad, cuadrar la caja
   es EL momento del día.

---

## 2 · La tesis del producto

Vectaryx es **el sistema operativo de un lugar de comida**, y crece con el
local. No vendemos "menú QR": vendemos que el pedido fluya solo desde que el
cliente lo escribe hasta que la caja lo cuadra, con el local puesto en medio de
la forma que ese local trabaja.

Tres tamaños de cliente, un solo producto:

| Cliente | Cómo trabaja | Qué usa de Vectaryx |
| --- | --- | --- |
| **Humilde** (menú, sanguchería, juguería) | Pides en el mostrador o desde el QR, recoges cuando te llaman | Carta + pedido de mostrador + cocina + **pantalla de despacho** + caja. Sin salón, sin mozos. |
| **Medio** (cevichería, chifa) | Mozos, mesas con QR, caja al salir | Todo lo anterior + mesas/QR + salón + llamar al mozo |
| **Completo** (restaurante formal) | Lo anterior + boleta/factura, reportes, insumos | + facturación SUNAT + pasarela + reportes + inventario |

Eso también dibuja los **planes de cobro** (hoy `restaurants.plan` es texto
libre): Despacho / Salón / Completo. La mensualidad ya existe en plataforma; los
planes pasan a activar módulos.

---

## 3 · Modos de servicio (el cambio de fondo)

Una sola columna nueva decide qué pantallas y qué flujo ve cada local:

```
restaurants.service_mode = 'despacho' | 'salon' | 'mixto'
```

Y el pedido declara de dónde nació y cómo se entrega:

```
orders.origin   = 'mesa' | 'mostrador'        (mesa exige table_id; mostrador no)
orders.delivery = 'mozo' | 'recojo'           (quién mueve el plato)
```

- **`despacho`** — no hay mesas ni salón. El QR es uno solo (pegado en el
  mostrador o en la pared) y lleva a la carta sin mesa. El pedido recibe su
  número del día y el cliente lo recoge cuando la cocina lo marca **Listo**. La
  pantalla de Salón desaparece del menú del local; aparece **Despacho**.
- **`salon`** — lo de hoy, intacto: QR por mesa, mozos, liberar mesa.
- **`mixto`** — mesas con QR **y** un QR de mostrador para llevar. Es el chifa
  real: comes ahí o pides para llevar en la misma caja.

Consecuencias por pantalla (esto es lo que hay que tocar, y nada más):

| Pantalla | En `despacho` | En `salon` (hoy) |
| --- | --- | --- |
| Carta | sin "Mesa 4" en la cabecera; pide nombre o deja solo el número de pedido | igual que hoy |
| Cocina | igual (la cocina no cambia nunca: esa es la gracia) | igual |
| **Despacho** (nueva) | pantalla pública para TV: dos columnas, **Preparando** / **LISTO — recoger**, números gigantes | no aparece |
| Salón | no aparece | igual que hoy |
| Caja | agrupa por número de pedido, no por mesa | igual que hoy |
| Seguimiento (cliente) | al pasar a Listo: **avisa** (§4) y dice "recógelo en el mostrador" | avisa "ya te lo llevan" |

`table_id` pasa a ser opcional **solo** para `origin='mostrador'`; para pedidos
de mesa sigue siendo obligatorio. Nada del flujo actual se rompe: `salon` es el
valor por defecto y los dos locales sembrados se quedan como están.

---

## 4 · Avisar al cliente

Cuatro niveles, del más barato al más caro. Se construyen en este orden y cada
uno vale por sí solo:

1. **La página avisa** (cliente con la página abierta): al pasar a **Listo**,
   la pantalla de seguimiento vibra (`navigator.vibrate`), suena, cambia el
   título de la pestaña ("🔔 ¡Listo!") y pinta un banner que no se puede no
   ver. Costo: una tarde. Cubre al 80% de los clientes.
2. **La pantalla de despacho** (cliente que guardó el celular): una TV en el
   local con `/despacho/[slug]` — pública, sin PIN, sin datos sensibles: solo
   números de pedido. Es como funciona toda cadena de comida rápida, y es la
   solución para el local humilde porque no le exige nada al cliente.
3. **Notificación push del navegador** (cliente que cerró la pestaña): Web
   Push con service worker. Requiere HTTPS (ya lo hay) y pedir permiso en el
   momento correcto: al enviar el pedido, "¿Te avisamos cuando esté listo?".
   Costo: días, no horas. Solo cuando 1 y 2 estén en producción.
4. **WhatsApp** (cliente que se fue a la esquina): vía API de Meta o un
   proveedor. Cuesta plata por mensaje → es rasgo del plan Completo. No ahora.

El mozo también es un cliente de avisos: **"Llamar al mozo"** desde la carta
(modo `salon`) es el mismo mecanismo apuntando al salón, y ya estaba pedido en
la revisión técnica.

---

## 5 · Estructura objetivo del código

Hoy (`src/` plano, 3 carpetas):

```
src/app/…            9 páginas (una por pantalla, hasta 985 líneas)
src/app/api/…        13 rutas con SQL y reglas adentro
src/app/components/  2 componentes (LangSwitch, StaffGate)
src/lib/             db, auth, i18n, types, payments, brand, money, …
```

Objetivo (mismo framework, sin reescribir: **extraer, no mover por mover**):

```
src/
  app/                       # SOLO rutas y composición de pantalla
    (cliente)/               #   carta, pedido, (futuro) recoger
    (local)/                 #   cocina, caja, salon, despacho, admin
    (operador)/              #   plataforma
    api/                     #   rutas delgadas: validar → llamar dominio → responder
  domain/                    # ⭐ nueva: la lógica de negocio, un archivo por módulo
    pedidos.ts               #   crear, avanzar estado, número del día, reglas de pago
    carta.ts                 #   categorías, platos, disponibilidad
    mesas.ts                 #   estado del salón, liberar mesa
    cobros.ts                #   confirmar pago, cobrados hoy, (futuro) arqueo
    locales.ts               #   restaurante, service_mode, marca
    avisos.ts                #   (futuro) push, despacho, llamar al mozo
  components/                # UI compartida entre pantallas (hoy 2, serán ~15)
  lib/                       # infraestructura pura: db, auth, i18n, money, rate-limit
```

Reglas que hacen que esto no se pudra:

- **Las páginas no hablan SQL.** Una página compone componentes y llama a
  `/api`; una ruta API valida y llama a `domain/`; solo `domain/` toca `db`.
- **Un módulo de dominio nuevo = un archivo nuevo en `domain/`** (inventario,
  facturación, reportes). El ERP crece por archivos, no por líneas en los
  existentes.
- **Partir los monolitos al tocarlos, no en un big-bang**: la primera fase toca
  carta, cocina y caja (modos de servicio) → esas tres se parten ahí. Admin se
  parte cuando le entre el CRUD que falta. Nunca "semana de refactor".
- `i18n.ts` (~700 líneas) se parte igual: `i18n/` con un archivo por idioma y
  el hook aparte. Mismo API público (`useT`), cero cambios en los consumidores.

### Qué es cada carpeta de la raíz (esto ya está bien y se queda)

`src/` la app · `scripts/` siembra y utilidades · `demo/` snapshot de la demo
pública · `docs/` las guías · `ops/` material de trabajo (arte, prompts, PDFs) ·
`data/` la base local (fuera de git).

---

## 6 · Esquema de datos: migraciones previstas

El sistema de migraciones versionadas ya existe (`src/lib/db.ts`, hoy va en la
4). Las siguientes, en orden:

| # | Qué | Columnas / tablas |
| --- | --- | --- |
| 5 | Modos de servicio | `restaurants.service_mode` (default `'salon'`); `orders.origin` (default `'mesa'`), `orders.delivery` (default `'mozo'`); `orders.table_id` pasa a nullable (recrear tabla, como se hizo en la 3) |
| 6 | Huellas de tiempo del pedido | `orders.ready_at`, `orders.delivered_at` — sin esto no hay reportes de tiempos ni "lleva 12 min esperando" honesto |
| 7 | Nombre del cliente en mostrador | `orders.customer_name` (opcional; en despacho "Pedido #12 · Óscar" es oro) |
| 8 | Llamadas al mozo | tabla `waiter_calls (id, restaurant_id, table_id, created_at, attended_at)` |
| 9 | Operación de caja | tabla `cash_sessions (id, restaurant_id, opened_at, closed_at, opening_cents, counted_cents, expected_cents, notes)` |
| 10 | Suscripciones push | tabla `push_subscriptions (id, order_id, endpoint, keys, created_at)` |

Inventario, facturación y multi-sede tendrán las suyas cuando les toque fase;
no se diseñan hoy (se diseñarían mal).

---

## 7 · Roadmap

### Fase 1 — Producto, no demo _(en ejecución)_

Es demasiada para una sentada, así que va en cuatro tramos. Cada uno **se puede
desplegar solo** y deja la app funcionando; ninguno depende de que el siguiente
llegue.

Los tests van **primero**, no al final. La Fase 1 mueve el esquema (`table_id`
deja de ser obligatorio) y toca las tres pantallas que un local usa en vivo. Sin
una red que avise cuando algo se rompe, cada tramo siguiente se prueba a mano y
a ciegas — y lo que se rompe en silencio en un sistema multitenant es lo peor
que puede pasar: que un local vea los pedidos de otro.

**1A · La red de seguridad** ✅ _(hecho — sin cambios visibles)_
- 25 tests de lo que no puede romperse nunca: aislamiento entre locales, el día
  de negocio por zona horaria, el flujo del pedido de la mesa a la caja.
  `npm test` (runner de Node, sin framework) · `npm run check` lo corre todo.
- `openDb(ruta)` + `VECTARYX_DATA_DIR`: los tests abren una base temporal real y
  le pasan las migraciones de producción, sin tocar la de desarrollo.
- `src/domain/pedidos.ts`: la lógica sale de las rutas API, que quedan en
  validar → llamar al dominio → responder. Sin esto los tests probarían una copia
  del SQL en vez del código que corre de verdad.
- Comprobado que la red **atrapa**: al quitar el filtro de tenant de la consulta
  de platos, el test de aislamiento falla. Un test que nunca falla no protege nada.

**1B · Modos de servicio** _(migración 5)_
- `restaurants.service_mode` = `despacho` | `salon` | `mixto`; `orders.origin` y
  `orders.delivery`; `table_id` pasa a nullable.
- Admin elige el modo. Las pantallas que no aplican dejan de aparecer.
- Caja agrupa por número de pedido cuando no hay mesa.

**1C · Despacho: el local sin mozos** _(el corazón de la fase)_
- Pedido de mostrador: QR único del local → carta sin mesa → nombre opcional.
- `/despacho/[slug]`: pantalla pública para la TV, números gigantes,
  **Preparando** / **LISTO**.
- Avisos nivel 1: la pantalla del cliente vibra, suena y cambia el título al
  pasar a Listo.

**1D · Producto, no demo**
- `/` pasa a ser la portada de Vectaryx; el índice de la demo se muda a `/demo`.
- README y `docs/` dejan de describir "la demo" y describen el producto.
- **Llamar al mozo** (modo salón; migración 8).

**Criterio de cierre de la Fase 1**: una juguería sin un solo mozo puede operar
el día completo — el cliente pide del QR del mostrador, la cocina prepara, la TV
canta el número, la caja cuadra — sin que nadie de Vectaryx toque nada.

### Fase 2 — La operación del dueño

- Apertura/cierre de caja con arqueo (migración 9).
- Reportes: ventas por día/semana, platos más vendidos, horas pico, tiempos de
  cocina (usa `ready_at`/`delivered_at` de la migración 6).
- CRUD completo en admin: renombrar/borrar categorías y mesas, ordenar la carta.
- Carta en dos idiomas escrita por el dueño (nombre y descripción por idioma —
  la interfaz ya está en tres; esto era "lo siguiente" en `GUIA_PRUEBAS.md`).

### Fase 3 — Dinero de verdad

- Pasarela de pago (Culqi / Izipay / Mercado Pago) — el "Ya pagué ✓" pasa a ser
  confirmación automática; la caja deja de verificar yapeos a ojo.
- **Boleta/factura electrónica SUNAT** vía PSE (Nubefact o similar; integrarse
  directo con SUNAT no es negocio nuestro).
- Push del navegador (nivel 3) y, si un cliente lo paga, WhatsApp (nivel 4).

### Fase 4 — El ERP completo

- Inventario: insumos, recetas por plato, descuento de stock al vender, mermas.
- Compras y proveedores.
- Personal: turnos y PINes individuales (hoy el PIN es del equipo).
- Multi-sede: un dueño, varios locales, una sola administración.
- Fidelización de clientes.

Cada fase entra **cuando la anterior está en producción y un local real la
usa**. El orden dentro de cada fase sí es negociable; el de las fases no: sin
modos de servicio no hay clientes humildes, sin operación de caja no hay dueños
contentos, sin SUNAT no hay restaurantes formales.

---

## 8 · Correcciones antes del siguiente deploy

Nada de lo desplegado está roto (main está limpio y la demo en Render sirve el
último build). Lo que hay que corregir es de presentación y de orden, y cae
todo en la Fase 1:

- [ ] `/` deja de ser el índice de la demo → portada de producto + `/demo`.
- [ ] `README.md` deja de describir "la demo" y describe el producto (la demo
      queda como una sección).
- [ ] `docs/`: `DEMO.md` y `GUIA_PRUEBAS.md` apuntan a `/demo`; este plan
      (`PLAN-ERP.md`) reemplaza al backlog difuso del final de
      `REVISION-TECNICA.md`, que queda como auditoría histórica.
- [ ] Confirmar en Render que `VECTARYX_PLATFORM_KEY` sigue puesta (sync:false)
      después de cualquier cambio de servicio.
- [ ] Recordatorio permanente: **Render free es solo para la demo** (sin disco,
      se resiembra al despertar). El primer cliente real va a VPS con disco
      (`DESPLIEGUE.md`) o a un plan con disco persistente.

## 9 · Lo que deliberadamente NO haremos todavía

- Cambiar SQLite por Postgres. Un VPS con SQLite en WAL aguanta de sobra los
  primeros N locales; migrar antes de necesitarlo es pagar por adelantado un
  problema que quizá nunca llegue. La señal para migrar: multi-sede o >1
  servidor.
- Apps nativas. La web en el celular ya hace todo; push del navegador cubre el
  aviso. Una app es un costo permanente que hoy no compra nada.
- Delivery a domicilio. Es otro negocio (reparto, direcciones, couriers). El
  modo `mostrador` deja la puerta del "para llevar" abierta, que es lo honesto.
- Cuentas de usuario para comensales. El QR y el localStorage siguen bastando;
  pedir registro para comerse un ceviche mata la conversión.
