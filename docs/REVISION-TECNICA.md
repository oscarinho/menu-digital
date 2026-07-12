# Revisión técnica — Vectaryx Pedidos en Mesa

## Estado (12 jul 2026)

**Aplicado — todo el P0 y parte del P1:**

| # | Qué | Dónde |
| --- | --- | --- |
| 1 | Zona horaria del local: "hoy" ya no es UTC | `businessDayRange()` en `src/lib/db.ts`, usado por `api/orders` y `api/platform/restaurants`; columna `restaurants.timezone` |
| 2 | La imagen de producción ya no siembra la demo | `Dockerfile` (`CMD npm start`), `render.yaml` (`dockerCommand`), y `scripts/demo-boot.mjs` exige `VECTARYX_DEMO=1` |
| 3 | Rate limiting del PIN (5/min por IP+local) | `src/lib/rate-limit.ts`, `api/auth`, `api/platform/auth` |
| 4 | Clave de plataforma obligatoria en producción; la cookie guarda un token de sesión, no el secreto | `src/lib/auth.ts` |
| 5 | PIN de dueño separado del de personal, con rol en la sesión | `restaurants.admin_pin`, `sessions.role`, `requireStaff(id, "admin")` |
| 6 | Cookies con `secure` en producción | `src/lib/auth.ts` |
| 7 | Rate limiting del POST público de pedidos (3/min) + tope de 40 líneas | `api/orders` |
| 8 | Imágenes optimizadas al subir (WebP, máx. 1400 px) | `api/upload`, con `sharp` |
| 9 | Migraciones versionadas (`schema_migrations`) | `src/lib/db.ts` |
| 10 | País real en los métodos de cobro; purga de sesiones caducadas; lint en verde; CSVs a `ops/` | varios |
| 12 | Wake Lock en cocina y caja | `src/lib/keep-awake.ts` |

**Pendiente, por orden:**

- **Verificado a mano, no automatizado (16).** El día local, el aislamiento entre
  tenants y la separación de roles se probaron contra la app corriendo, pero no hay
  tests que impidan romperlo mañana. Es lo primero que falta.
- **CRUD completo en admin (10):** renombrar y borrar categorías y mesas.
- **Observabilidad (11):** logging de errores de API, healthcheck en compose,
  monitor de uptime, y probar una restauración de backup de verdad.
- **Producto (12):** botón "llamar al mozo" y modificadores de plato.
- **Todo el P2:** no tocar hasta que el piloto valide.

Dos decisiones conscientes: la demo pública sigue usando la carta y la marca de
**Punto Azul** (es la propuesta para ese cliente; si no hay acuerdo, hay que
renombrarla), y los locales que ya existían heredaron `admin_pin = staff_pin`, así
que **el rol de dueño no protege nada hasta que ponga un PIN distinto** desde
Admin → Cobros y seguridad.

---

> Auditoría de arquitectura, seguridad y escalabilidad (jul 2026), pensada para
> ejecutarse con Claude Code. Cada ítem indica archivo y qué cambiar.
> Veredicto general: el stack (Next.js 16 + SQLite + VPS con Docker/Caddy) es
> **correcto para el piloto de Lima**. El aislamiento multitenant está bien
> aplicado en todas las APIs (`requireStaff` valida sesión vs. restaurante en
> cada ruta). Lo que sigue son correcciones puntuales, no un rediseño.

---

## P0 — Corregir ANTES de poner un restaurante real (bugs y seguridad)

### 1. Zona horaria: "hoy" es UTC, no hora de Lima
El bug más importante para operación real. Lima es UTC-5 y SQLite `date('now')`
usa UTC: **a las 7:00 pm hora local cambia el "día"**. Consecuencias:

- El número diario de pedido (`daily_number`) se reinicia a #1 en plena cena
  → `src/app/api/orders/route.ts` (~línea 76, `COUNT ... date(created_at) = date('now')`).
- La vista "día" de pedidos → mismo archivo (~línea 139).
- Métricas `orders_today` / `revenue_today_cents` del panel de plataforma
  → `src/app/api/platform/restaurants/route.ts` (subqueries del GET).

**Fix propuesto:** columna `timezone TEXT NOT NULL DEFAULT 'America/Lima'` en
`restaurants` + helper único en `src/lib/db.ts` (p. ej. `businessDate(tz)` que
calcula la fecha local con `Intl.DateTimeFormat`) y comparar
`date(created_at, '-5 hours')` o pasar la fecha calculada como parámetro.
Perú no tiene horario de verano, pero centralizarlo en un helper deja listo el
multi-país. Cubrir con un test los tres puntos de uso.

### 2. La imagen Docker de producción arranca la demo
`Dockerfile` termina en `CMD ["npm", "run", "demo:start"]` y `docker-compose.yml`
(producción en VPS) usa esa misma imagen. En el **primer despliegue** el volumen
`./data` está vacío → `scripts/demo-boot.mjs` copia `demo/menu.db` (carta
completa de Punto Azul, PIN `1234` público) a la base de producción.

**Fix:** `CMD ["npm", "start"]` en el Dockerfile y en `render.yaml` (demo)
sobreescribir con `dockerCommand: npm run demo:start`. Alternativa: que
`demo-boot.mjs` solo actúe si `VECTARYX_DEMO=1`. Cualquiera de las dos, pero
que producción jamás siembre datos demo.

### 3. PIN sin límite de intentos (fuerza bruta trivial)
`POST /api/auth` (`src/app/api/auth/route.ts`) acepta intentos ilimitados de un
PIN de 4-6 dígitos: 10,000 combinaciones se prueban por script en minutos y dan
acceso a admin/cocina/caja del local.

**Fix:** rate limiting en memoria por IP+slug (p. ej. 5 intentos/min con
backoff, un `Map` con timestamps basta — es un solo proceso Node). Aplicar
también a `POST /api/platform/auth`. Guardar el PIN con hash (bcrypt/scrypt)
es deseable, aunque con rate limiting deja de ser urgente.

### 4. Clave de plataforma: fallback hardcodeado y cookie que contiene el secreto
`src/lib/auth.ts`:

- Línea 12: `process.env.VECTARYX_PLATFORM_KEY ?? "vectaryx2026"` — si la env
  falta en producción (deploy manual, typo), la clave es la pública de demo.
  **Fix:** en producción (`NODE_ENV === 'production'` y sin `VECTARYX_DEMO`),
  lanzar error al arrancar si no hay clave definida.
- `setPlatformCookie()` guarda **la clave misma** como valor de la cookie y
  `isPlatformAdmin()` compara cookie === clave. Si la cookie se filtra (log,
  XSS futuro, soporte remoto), se filtró la clave maestra y no hay forma de
  revocarla sin rotarla. **Fix:** emitir un token de sesión aleatorio (tabla
  `sessions` con `restaurant_id NULL` o tabla propia) igual que el staff.

### 5. Un solo PIN = un solo rol por restaurante
El mismo PIN abre `/admin`, `/cocina` y `/caja`. Un mesero o cocinero puede
entrar a `/admin/{slug}` y cambiar precios, datos de cobro (¡número de Yape!)
o el propio PIN (`PATCH /api/restaurants/[slug]` permite `staffPin` con sesión
staff normal).

**Fix mínimo viable:** columna `admin_pin` separada; `requireStaff` gana un
parámetro `role: 'staff' | 'admin'`; `/admin` y el PATCH de ajustes exigen
`admin`. El cambio de número Yape/Plin es especialmente sensible: es redirigir
el dinero del local.

### 6. Cookies sin flag `secure`
`store.set(...)` en `src/lib/auth.ts` no marca `secure: true`. Detrás de Caddy
todo es HTTPS, pero si alguien entra por HTTP antes del redirect la cookie
viaja en claro. **Fix:** `secure: process.env.NODE_ENV === "production"` en
ambas cookies.

---

## P1 — Durante el piloto (robustez y producto)

### 7. Rate limiting del POST público de pedidos
`POST /api/orders` es público (correcto: el comensal no se autentica), pero sin
límite: un script puede inundar la cocina de comandas falsas. Mitigación
proporcional al piloto: límite por IP (p. ej. 3 pedidos/min) + tope de líneas
por pedido (ya hay tope de cantidad ≤ 50, falta tope de ítems distintos).
Hardening futuro (no ahora): tokens HMAC por mesa en el QR.

### 8. Optimizar imágenes al subir
`src/app/api/upload/route.ts` guarda el archivo original (hasta 4 MB) y el menú
lo sirve tal cual a celulares con datos móviles. Con `sharp`: redimensionar a
~1000 px, convertir a WebP calidad ~80, y generar thumbnail ~200 px para las
tarjetas. Una carta de 100 platos pasa de ~200 MB potenciales a ~10 MB.
(`/api/images/[name]` ya envía `Cache-Control: immutable`, eso está bien.)

### 9. Migraciones versionadas
`addColumn()` en `src/lib/db.ts` funciona pero no escala: no permite renombrar,
borrar, backfills ni saber qué versión tiene cada base. Tabla
`schema_migrations (version INTEGER)` + array de migraciones numeradas que se
aplican en orden dentro de una transacción. Hacerlo ahora que hay 1 base y 0
clientes; con 20 locales en producción será doloroso.

### 10. Roles/limpieza menores (verificados en código)
- `src/app/caja/[slug]/page.tsx` (~línea 41): `getPaymentMethods("PE")`
  hardcodeado; usar `restaurant.country` que ya llega en la API.
- Sesiones expiradas nunca se borran de la tabla `sessions` (el SELECT filtra
  por fecha, pero las filas quedan). Un `DELETE` periódico al hacer login basta.
- `npx eslint src` reporta 2 errores `react-hooks/set-state-in-effect` en
  `src/app/components/StaffGate.tsx` — arreglar para dejar lint en verde.
- Admin no puede renombrar/borrar categorías ni borrar/renombrar mesas (solo
  crear). Completar CRUD.
- CSVs de trabajo (`punto-azul-imagenes-ronda-*.csv`, etc.) sueltos en la raíz
  del repo: mover a `ops/` o sacarlos del repo.
- Demo pública usa la marca y carta del restaurante real "Punto Azul": si no
  hay acuerdo con el local, renombrar la demo a un restaurante ficticio.

### 11. Operación: observabilidad y salud
Para un piloto operado a distancia (socio en Lima, tú fuera):

- Logging estructurado de errores de API (hoy los `catch` silencian) + Sentry
  free tier o similar.
- `healthcheck` del servicio `app` en `docker-compose.yml` (curl a `/`).
- Monitor externo de uptime (UptimeRobot free) apuntando al dominio.
- Probar la restauración del backup una vez (no solo generarlo) y sincronizar
  `backups/` fuera del VPS (rclone a un bucket; `deploy/backup.sh` ya deja los
  archivos listos).

### 12. Detalles de piso de restaurante (baratos, alto impacto)
- **Wake Lock** en `/cocina` y `/caja` (`navigator.wakeLock`): que la tablet no
  se apague en servicio. Hoy si la pantalla se duerme, la cocina no ve pedidos.
- Botón "Llamar al mozo" en la mesa (frecuentemente pedido; barato: un estado
  más que aparece en cocina/caja).
- **Modificadores de plato** (término de la carne, "sin cebolla", tamaño,
  acompañamiento): el vacío de producto más grande frente a competidores. Las
  `notes` por ítem ya existen y cubren el piloto, pero los modificadores
  estructurados (grupo de opciones con precio extra) son la evolución natural
  del modelo (`menu_item_options`).

---

## P2 — Antes de escalar (no tocar hasta que el piloto valide)

### 13. Cuándo y cómo migrar de SQLite
El esquema actual (1 VPS, SQLite WAL, polling 3-4 s) aguanta decenas de locales
sin despeinarse; el acceso a datos ya está centralizado en `src/lib/db.ts`, que
es la decisión que hace viable la migración. Disparadores concretos para
migrar:

- &gt; ~50-80 locales activos, o
- necesidad de una 2ª instancia (alta disponibilidad o 2ª región/país), o
- picos sostenidos &gt; ~20 pedidos/s (muy lejos del piloto).

Destino: **Postgres gestionado** (Neon/Supabase/RDS) + **objetos en
S3-compatible** (Cloudflare R2 para `uploads/`) + sesiones igual en BD. Pasos:
introducir una capa fina de repositorio sobre `db.ts`, portar migraciones,
`pg` o Drizzle como cliente. Las imágenes pueden migrar a R2 **antes** que la
BD si el disco del VPS pasa de ~70%.

### 14. Tiempo real: de polling a SSE
El polling actual es correcto (simple, se reconecta solo). Con decenas de
locales, cada tablet son ~20-30 req/min. Migrar cocina/caja/tracking a
**Server-Sent Events** (un endpoint `GET /api/events?slug=` que empuja cambios)
mantiene la simplicidad (sin WebSocket bidireccional, reconexión nativa del
navegador) y reduce carga y latencia. Requiere proceso único o pub/sub — en el
VPS actual funciona directo.

### 15. Imagen Docker más liviana y deploys sin corte
- `output: "standalone"` en `next.config.ts` + `CMD ["node", "server.js"]`:
  imagen mucho menor y arranque más rápido.
- `docker compose up --build` corta el servicio unos segundos; para el piloto
  es aceptable, documentar hacerlo fuera de horario de servicio. Escalando:
  build en CI + pull de imagen.

### 16. Tests mínimos automatizados
Hoy: 0 tests (existe `GUIA_PRUEBAS.md` manual, que está bien para el socio).
Mínimo que paga su costo: un e2e de Playwright del flujo crítico (pedir desde
mesa → aparece en cocina → avanzar estado → cobrar en caja) + tests de API para
aislamiento multitenant (sesión del restaurante A no toca datos de B) y para el
helper de fecha local del punto 1. Correr en CI (GitHub Actions) en cada push.

### 17. Camino a boleta/factura (SUNAT)
No para el piloto, pero es EL diferenciador en Perú a mediano plazo: emitir
boleta electrónica desde caja (vía OSE/PSE tipo Nubefact). El modelo ya guarda
snapshot de precios por línea, que es la base. Diseñar `orders` pensando en eso
(RUC del local, serie/correlativo) cuando se toque el esquema.

---

## Lo que está BIEN y no hay que "mejorar"

Para que Claude Code no lo "arregle": precios en céntimos con snapshot por
línea de pedido (correcto); `requireStaff` en cada ruta de staff (multitenancy
sólido); transacciones en creación de pedido y de restaurante; validación de
`path traversal` en `/api/images`; Yape/Plin con confirmación manual en caja en
vez de pasarela (correcto para Perú: sin comisiones y sin fricción); WAL en
SQLite; backup con `.backup` API (consistente); Caddy con TLS automático;
polling simple en vez de WebSockets prematuros; UUIDs como IDs públicos de
pedido (tracking sin auth es aceptable); demo en Render free que se resiembra
sola (buena idea de marketing).

---

## Monetización (base: mensualidad + contexto real del mercado)

Referencias de mercado (jul 2026): PANCA cobra S/ 99–119/mes, sistemas básicos
promedian ~US$ 35/mes, y OlaClick tiene plan gratuito permanente de carta QR.
El S/ 99 por defecto del sistema (`monthly_fee_cents = 9900`) está en rango,
pero solo se sostiene vendiendo **pedidos + cocina + caja**, no carta QR sola
(eso ya es gratis en el mercado).

**Estructura sugerida de planes:**

| Plan | Precio ref. | Incluye |
| --- | --- | --- |
| Carta | S/ 49/mes | Solo menú QR con fotos y marca (puerta de entrada; migrar hacia arriba) |
| Mesa | S/ 129/mes | Pedidos + cocina + caja + Yape/Plin (el producto actual) |
| Pro | S/ 249/mes | + modificadores, reportes, multi-caja, PIN por rol, prioridad de soporte |

**Ideas complementarias (ordenadas por esfuerzo/retorno):**

1. **Setup fee S/ 150–300** por local: digitalización de la carta, fotos de los
   platos y QRs impresos/laminados. El socio de Lima lo ejecuta; cubre CAC y
   filtra curiosos. El pipeline de fotos con IA que ya usaste para Punto Azul
   (CSVs de rondas) es exactamente este servicio, sistematizado.
2. **Bandera "0% comisión"**: posicionamiento directo contra apps de delivery
   que cobran ~30%. La mensualidad fija es el mensaje de venta, no un detalle.
3. **"Powered by Vectaryx"** en el pie del menú del plan base; quitarlo cuesta
   plan Pro. Cada mesa es un anuncio a comensales (que a veces son dueños de
   otros locales) — loop viral incorporado.
4. **Add-on WhatsApp (S/ 30–50/mes):** aviso "tu pedido está listo", boleta
   digital por WhatsApp y, con permiso, lista de remarketing del local
   ("los ceviches de hoy"). En Perú WhatsApp es el canal, no el email.
5. **Anual = 10 meses** (2 gratis): caja adelantada para financiar el piloto.
6. **Referidos:** 1 mes gratis por local referido que active; en el gremio
   gastronómico de Lima el boca a boca entre dueños es fortísimo.
7. **Licencia por ciudad/país** para operadores locales (el modelo de tu socio,
   formalizado): el operador vende, instala y da soporte de primera línea, se
   queda 20–30% del MRR de su cartera. Así se replica sin contratar.
8. **Comodato de tablet de cocina** (+S/ 30–40/mes): elimina la fricción #1 de
   adopción ("no tengo dónde ver los pedidos").
9. **Plan alternativo sin fijo** para locales muy chicos: S/ 0 + S/ 0.30 por
   pedido con tope mensual (el que crece termina prefiriendo el fijo; el que
   no, no te cuesta). Solo si el fijo genera resistencia en el piloto.
10. **Futuro (post-piloto):** pasarela integrada (Culqi/Izipay/Mercado Pago)
    como módulo opcional con margen por transacción para locales que quieran
    conciliación automática; reportes mensuales "qué platos rinden" (menu
    engineering) como parte del plan Pro; facturación SUNAT como add-on — la
    interfaz de `src/lib/payments.ts` ya está diseñada para enchufar esto.

**KPIs del piloto a registrar desde el día 1** (el panel ya calcula parte):
pedidos/local/día, ticket promedio con vs. sin la app, % de pagos Yape/Plin
informados desde la app, churn mensual, y tiempo cocina (creado→listo). Son el
argumento de venta para los siguientes locales y la evidencia para subir el
precio.

---

*Fuentes de mercado: panca.pe (blog, precios de sistemas QR en Perú),
olaclick.com (comparativa de sistemas para restaurantes en Perú).*
