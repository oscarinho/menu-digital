# Guía de pruebas — Vectaryx Pedidos en Mesa 🇵🇪

SaaS multitenant para restaurantes: el comensal escanea el QR de su mesa, pide
desde su celular con el menú (fotos, marca y colores del local), paga por
Yape/Plin desde el mismo pedido, la cocina lo ve en su pantalla y la caja
confirma el cobro. Vectaryx (nosotros) cobra una mensualidad a cada restaurante.

---

## 1. Cómo levantar la app

```bash
npm install
npm run build
npm run start      # producción en http://localhost:3000
# o para desarrollo con recarga en vivo:
npm run dev
```

La primera vez se crea sola la base `data/menu.db` con un restaurante demo.

**Para probar desde el celular** (misma red WiFi): usa la IP de la máquina en
vez de `localhost`. En Mac: `ipconfig getifaddr en0` → p. ej.
`http://192.168.1.50:3000/r/demo/mesa/1`.

## 2. Credenciales de prueba

| Qué | Valor |
| --- | --- |
| Clave de plataforma (operador Vectaryx) | `vectaryx2026` |
| PIN de "La Cevichería del Puerto" (`demo`) | `1234` (personal y dueño) |
| PIN de "Pollería Don Pepe" (`polleria-don-pepe`) | `5678` (personal y dueño) |

En los locales de prueba ambos PINes coinciden. En uno real hay que ponerlos
distintos desde **Admin → Cobros y seguridad**: mientras coincidan, quien trabaja
en cocina puede cambiar el número de Yape al que llega el dinero del local.

## 3. Los 4 roles

| Rol | Quién es | URL | Acceso |
| --- | --- | --- | --- |
| **Operador (Vectaryx)** | Nosotros: alta de restaurantes, mensualidad, MRR, suspender morosos | `/plataforma` | Clave de plataforma |
| **Dueño del restaurante** | Nuestro cliente: menú, fotos, precios, marca, QRs de mesa, datos de cobro | `/admin/{slug}` | **PIN del dueño** |
| **Personal del local** | Cocina y caja | `/cocina/{slug}` · `/caja/{slug}` | **PIN del personal** (no abre `/admin`) |
| **Comensal** | Cliente final en la mesa. Sin login, sin app | `/r/{slug}/mesa/{n}` | Ninguno |

---

## 4. Guion de prueba (ciclo de vida real, ~15 min)

### Acto 1 — Vendemos el servicio (operador)

1. Abrir `/plataforma`, entrar con `vectaryx2026`.
2. Crear un restaurante: nombre **"Chifa El Dragón"**, PIN `4321`,
   mensualidad `149`, mesas `8`. El slug se genera solo (`chifa-el-dragon`).

- [ ] Aparece en la lista con su mensualidad y métricas en cero
- [ ] El MRR del encabezado subió

### Acto 2 — El dueño arma su carta y su marca

3. Abrir `/admin/chifa-el-dragon`, PIN `4321`.
4. Pestaña **Menú**: agregar 2-3 platos con precio; subir foto a alguno (📷).
5. Pestaña **Marca**: subir logo, subir foto de portada, elegir color
   (ej. rojo) y **Guardar color**. La vista previa muestra cómo quedará.
6. Pestaña **Cobros**: poner números de Yape/Plin y subir un QR de cobro
   (cualquier imagen sirve para la prueba).
7. Pestaña **Mesas y QR**: ver los QR imprimibles (eso se pega en las mesas).

- [ ] La foto aparece en el plato
- [ ] La vista previa de marca cambia con el color elegido

### Acto 3 — Un comensal pide y paga

8. Abrir `/r/chifa-el-dragon/mesa/1` (idealmente en el celular).
9. Verificar la **personalización**: portada, logo y color del chifa —
   comparar con `/r/demo/mesa/1` (azul) y `/r/polleria-don-pepe/mesa/1`
   (rojo). Misma app, tres marcas distintas: eso es el multitenant.
10. Agregar platos, elegir **Yape**, enviar pedido.
11. En el tracking: ver el QR de cobro y el número → tocar **"Ya pagué ✓"**.

- [ ] El menú es el del chifa (no el de la cevichería)
- [ ] El tracking muestra logo/color del local y queda "esperando confirmación de caja"

### Acto 4 — El local opera

12. Cocina: `/cocina/chifa-el-dragon` (PIN `4321`). Activar el sonido 🔔 y
    avanzar el pedido: Nuevo → En preparación → Listo.
13. Caja: `/caja/chifa-el-dragon`. El pago informado sale resaltado en azul →
    **"Confirmar pago recibido ✓"**.

- [ ] El pedido llegó solo (se refresca cada ~3 s) y suena al llegar uno nuevo
- [ ] En el celular del comensal el estado avanza solo y el pago queda confirmado ✓

### Acto 5 — El restaurante no paga la mensualidad

14. Volver a `/plataforma` → **Suspender** al chifa.
15. Recargar la vista del comensal: ya no acepta pedidos (aviso amable).
16. **Reactivar** → vuelve a funcionar.

- [ ] Suspendido no vende; reactivado sí

### Seguridad (rápido)

- [ ] Abrir `/cocina/demo` en ventana de incógnito → pide PIN
- [ ] Entrar con PIN de `demo` no permite tocar datos de otro restaurante (las APIs devuelven 401)
- [ ] La API pública `/api/restaurants/demo` no expone el PIN

---

## 5. Dónde subirlo para el piloto en vivo (Lima)

La app hoy usa **SQLite + archivos locales** (`data/`), así que necesita un
servidor con **disco persistente** — no serverless. Opciones ordenadas por
recomendación para el piloto:

| Opción | Costo aprox. | Por qué |
| --- | --- | --- |
| **1. VPS (DigitalOcean/Vultr/Hetzner)** | US$ 6–12/mes | Un solo servidor corre todo (Next.js + SQLite + uploads) sin cambiar una línea de código. Elegir región São Paulo (~60-90 ms desde Lima). Con Caddy o Nginx se obtiene HTTPS automático. Control total, ideal para 5–20 restaurantes del piloto. |
| **2. Fly.io con volumen** | ~US$ 5/mes | Deploy con Dockerfile + volumen persistente para `data/`. Región `gru` (São Paulo) o `bog` (Bogotá). Menos administración que un VPS. |
| **3. Railway / Render con disco** | US$ 5–10/mes | Deploy directo desde GitHub con disco persistente. Muy cómodo, aunque sus regiones (EE. UU.) agregan ~100-150 ms — aceptable para el piloto. |
| **4. Vercel** | Gratis/US$ 20 | ⚠️ Solo si migramos primero: SQLite → Postgres/Turso y uploads → Vercel Blob (el filesystem serverless es efímero). Es el destino natural a mediano plazo, pero implica trabajo previo. |

**Recomendación**: VPS en São Paulo con dominio propio (ej.
`app.vectaryx.com`) y HTTPS vía Caddy. Es lo más barato, cero cambios de
código, y para un piloto de decenas de restaurantes con polling cada 3-4 s
sobra capacidad. Cuando el piloto valide, migramos a Postgres + blob storage y
ahí sí Vercel u otra nube con autoescalado.

**Checklist antes de salir a internet:**

- [ ] Cambiar `VECTARYX_PLATFORM_KEY` (no usar la clave demo)
- [ ] Cambiar los PIN demo y borrar los restaurantes de prueba
- [ ] HTTPS obligatorio (Yape/Plin y las cámaras QR del iPhone lo requieren)
- [ ] Respaldo diario de `data/` (menu.db + uploads) — un cron con rsync basta
- [ ] Dominio corto para los QR (se imprimen: que no cambie después)

## 6. Notas para el piloto con el socio en Lima

- El socio comercial consigue los locales; el onboarding de cada restaurante
  toma minutos: crearlo en `/plataforma`, cargar carta y marca en `/admin`,
  imprimir QRs. No hay que instalar nada en el local (la cocina usa cualquier
  tablet/TV con navegador).
- Los chifas son un nicho ideal de entrada: carta larga y estable, alta
  rotación de mesas, y el flujo Yape/Plin reduce la carga de caja.
- Si el socio lo necesita, el panel de admin puede traducirse al chino
  (interfaz i18n) en una fase siguiente — la carta del comensal ya es la del
  local, en español.
- Pendientes de producto post-piloto: pasarela online real (Culqi/Mercado
  Pago/Izipay), boleta/factura SUNAT, cobro automatizado de la mensualidad y
  rate limiting del login por PIN.
