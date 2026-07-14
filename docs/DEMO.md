# Demo de Vectaryx

Una demo que puede usar cualquiera desde su celular, sin instalar nada y sin
pagar hosting. Van **dos restaurantes reales** sobre la misma app, que es la
forma más corta de enseñar el multitenant:

| Restaurante | Slug | Carta | Marca |
| --- | --- | --- | --- |
| **Punto Azul** (cevichería) | `punto-azul` | 113 platos, 16 categorías, 33 con foto | azul `#0a5aa8` |
| **Lanzhou Noodles** (fideos) | `lanzhou-noodles` | 34 platos, 5 categorías, nombre en chino y traducción debajo | verde `#1f5c3d` |

Abrir las dos cartas una al lado de la otra es el argumento de venta: misma app,
otra marca, otra carta, otro idioma.

## Qué verá quien entre

Cambia `<slug>` por `punto-azul` o `lanzhou-noodles`.

| Pantalla | URL | Acceso |
| --- | --- | --- |
| Portada (índice de la demo) | `/` | libre |
| Cliente en la mesa | `/r/<slug>/mesa/1` … `/mesa/10` | libre |
| Seguimiento del pedido | `/pedido/<id>` (sale solo al pedir) | libre |
| Cocina | `/cocina/<slug>` | PIN del personal **1234** |
| Caja | `/caja/<slug>` | PIN del personal **1234** |
| Salón (mapa de mesas) | `/salon/<slug>` | PIN del personal **1234** |
| Administración del local | `/admin/<slug>` | PIN del dueño **1234** |
| Panel de plataforma (operador) | `/plataforma` | clave privada (`VECTARYX_PLATFORM_KEY`) |

> En la demo ambos PINes son `1234` para poder pasear por todo. En un local real
> son distintos: con el del personal se entra a cocina y caja, pero **no** a la
> administración, donde se cambian los precios y el número de Yape.

El recorrido que convence en 2 minutos: abre **Cliente** en el celular y
**Cocina** en la laptop. Pides desde el celular → el pedido aparece en cocina en
menos de 3 segundos → avanzas el estado y el cliente lo ve cambiar solo → el
cliente pulsa "Ya pagué" → se enciende en **Caja** para confirmarlo.

Si además quieres enseñar el multitenant, abre las dos cartas en pestañas
distintas: cada local tiene su color, su carta y su numeración de pedidos del
día (los dos empiezan en #1, no comparten nada).

> Los números de Yape y Plin de la demo (`987 654 321`) son **ficticios**. Con
> `VECTARYX_DEMO=1` la pantalla de pago lo advierte. No pongas ahí números reales
> mientras la demo sea pública.

## Publicarla gratis (Render)

Render corre este contenedor gratis y sin tarjeta. El plan free **duerme el
servicio tras ~15 min sin tráfico** (el primer acceso tarda ~30 s en despertar) y
**no tiene disco**: al reiniciarse, la demo se resiembra sola desde `demo/` y
aparece limpia. Para una demo eso es una ventaja; para un cliente real no sirve
— ahí va el VPS de `DESPLIEGUE.md`.

1. Sube el repo a GitHub (privado o público, da igual).
2. Entra a [render.com](https://render.com) → **New → Blueprint** → conecta el
   repo. Render lee `render.yaml` y crea el servicio `vectaryx-demo` en plan free.
3. Te pedirá el valor de `VECTARYX_PLATFORM_KEY`: pon una clave larga tuya. Es la
   única puerta del panel `/plataforma`, así que no la repartas con la demo.
4. Espera el primer build (~5 min). Te queda una URL tipo
   `https://vectaryx-demo.onrender.com`.

Cada `git push` a la rama por defecto vuelve a desplegar.

## Antes de repartir el link

Cinco minutos que evitan el ridículo:

- [ ] Abre la URL de Render y espera a que despierte. Comprueba que la **portada**
      carga y que se ven **los dos restaurantes**.
- [ ] Entra a `/plataforma` con tu clave. Si te deja entrar con `vectaryx2026`,
      **no** pusiste `VECTARYX_PLATFORM_KEY`: párate y ponla.
- [ ] Haz un pedido completo desde el celular de verdad, no desde el simulador del
      navegador.
- [ ] Comprueba que la pantalla de pago **avisa de que los números son ficticios**
      (ese aviso sale sólo si `VECTARYX_DEMO=1`).
- [ ] Manda [GUIA_PRUEBAS.md](GUIA_PRUEBAS.md) junto con el link: sin el guion, el
      que prueba abre la carta, no sabe qué mirar y se va.
- [ ] **No** mandes la clave de `/plataforma` con el link. Ese panel es el tuyo,
      no el del que prueba.

Y avísale de dos cosas, o creerá que está roto: **el primer acceso tarda ~30 s**
(el plan free duerme el servicio) y **los pedidos se borran** al reiniciarse.

## Enseñarla sin internet (misma WiFi)

```bash
npm run demo:reset     # deja la carta de Punto Azul, borra pedidos previos
npm run dev            # o: npm run build && npm run demo:start
```

Averigua tu IP local (`ipconfig getifaddr en0` en macOS) y comparte
`http://<tu-ip>:3000/r/punto-azul/mesa/1`. Sirve para una mesa de verdad, con el
celular del dueño del restaurante.

## Los QR de las mesas

En `/admin/punto-azul → Mesas & QR` hay un QR por mesa, con botón para
descargarlo en PNG e imprimirlo. **El QR apunta al dominio desde el que abres el
admin**, así que genéralos ya desplegado (desde la URL de Render), no desde
`localhost`.

## Volver a dejar la demo limpia

```bash
npm run demo:reset
```

Borra `data/` y la reconstruye desde el snapshot `demo/` (base + fotos). En
Render no hace falta: pasa solo en cada reinicio.

## Actualizar el snapshot

Si cambias la carta desde `/admin` y quieres que ese sea el nuevo punto de
partida de la demo:

```bash
cp data/menu.db demo/menu.db
cp data/uploads/* demo/uploads/
git add demo && git commit -m "Actualiza snapshot de la demo"
```

## Antes de un cliente de verdad

- Hosting con disco persistente (VPS + `docker-compose.yml` + `Caddyfile`, ver
  `DESPLIEGUE.md`): en el plan free se perderían los pedidos al reiniciar.
- `VECTARYX_DEMO` **sin** poner (o `=0`), y los Yape/Plin reales del local. La
  imagen arranca con `npm start`, que **no** siembra nada: sólo la demo usa
  `demo:start`, así que la carta de Punto Azul nunca cae en la base de un cliente.
- Cambiar **los dos PINes** (hoy ambos `1234`) desde `/admin → Cobros y seguridad`,
  y ponerlos distintos: mientras coincidan, cualquiera de cocina puede cambiar el
  número de Yape al que llega el dinero.
- `VECTARYX_PLATFORM_KEY` es obligatoria: en producción el panel no arranca sin ella.
- Pasarela de pago real y facturación SUNAT siguen pendientes: hoy el flujo es
  "el cliente yapea y avisa, la caja confirma".
