# Probar Vectaryx en 10 minutos

Esto es lo que le pasas a quien va a probar la demo. No hay que instalar nada ni
crear ninguna cuenta: todo se abre en el navegador.

**Lo ideal es tener dos pantallas**: el celular hace de comensal y la laptop de
restaurante. Si solo tienes una, usa dos pestañas.

---

## Qué es esto

Un restaurante pega un QR en cada mesa. El cliente lo escanea, ve la carta con
fotos, pide desde su celular y paga por Yape o Plin sin levantarse. El pedido
aparece solo en la pantalla de la cocina, y la caja confirma el cobro. Nosotros
(Vectaryx) le cobramos al restaurante una mensualidad.

En la demo hay **dos restaurantes distintos sobre la misma app**, que es justo lo
que hay que ver: la misma aplicación con otra marca, otra carta y otro idioma.

| Restaurante | Qué vende |
| --- | --- |
| **Punto Azul** | Cevichería limeña. Azul, 113 platos. |
| **Lanzhou Noodles** | Fideos chinos del noroeste. Verde, carta en chino con la traducción debajo. |

La **portada** (`/`) es la cara del producto: lo que vería un dueño de restaurante
antes de comprarlo. Desde ahí, **"Ver cómo funciona"** te lleva a **`/demo`**, que
es el índice de esta prueba: los dos restaurantes.

Cada local se abre por **su propia puerta** (`/punto-azul`, `/lanzhou-noodles`):
ahí manda su logo y su color, y desde ella se entra a cocina, caja, salón y
administración. Es lo que el personal abriría en la tablet.

**Los PIN son `1234`** (tanto el del personal como el del dueño, para que puedas
pasear por todo).

> **Pruébalo como app, no como web.** En la puerta de un local, usa el menú del
> navegador → *Instalar aplicación* / *Añadir a pantalla de inicio*. Queda un icono
> con el color y las iniciales del restaurante, y al abrirlo no hay barra de
> direcciones ni pestañas. Así es como lo usa una cocina de verdad.

---

## El idioma, pantalla por pantalla

Arriba de cada pantalla hay un **ES · EN · 中文**. No es un ajuste del restaurante:
es de la pantalla, y cada una recuerda el suyo.

Eso es a propósito. En un local chino de Lima, la tablet del pase la mira un cocinero
que quizá no lee español, y la caja la lleva personal peruano: son dos aparatos
distintos a diez metros uno de otro, y cada uno necesita su idioma **a la vez**.
Pruébalo — pon la **cocina en 中文** y abre después la **caja**: sigue en español. El
dueño, que puede ser chino, peruano o americano, tiene el suyo en Administración.

También está en la pantalla del PIN, no solo detrás: quien no lee español tiene que
poder cambiarlo **antes** de entrar.

Lo que no se traduce son los **nombres de los platos**: esos son la carta del
restaurante, no la aplicación. Por eso Lanzhou sigue enseñando 牛肉拉面 con su
traducción debajo, la pongas en el idioma que la pongas.

---

## El recorrido

### 1 · Eres el cliente (en el celular)

En la tarjeta de Punto Azul, toca **Mesa 1**. Es lo que ve alguien que acaba de
escanear el QR pegado en su mesa: en el local de verdad no eliges, te lo da el QR.
Aquí puedes entrar como cualquiera de las 10 mesas — hazlo desde dos o tres
distintas, y en el paso 4 verás el salón llenarse.

- **Busca un plato.** La carta de Punto Azul tiene 113 y 16 categorías. Escribe
  "ceviche" arriba: la carta entera se vuelve una sola lista. Sin eso, encontrar
  algo era ir pestaña por pestaña — dinos si ahora lo encuentras rápido.
- Toca un plato para ver la foto grande, los ingredientes y el detalle.
- Agrega dos o tres platos. Mira cómo crece el carrito abajo.
- Elige **Yape** y envía el pedido.
- Quedas en la pantalla de seguimiento, con el número de Yape y el QR de cobro
  del restaurante. **No transfieras nada**: los números son inventados y la
  pantalla te lo avisa. Toca **"Ya pagué ✓"**.

Deja esa pantalla abierta. Se actualiza sola.

### 2 · Eres la cocina (en la laptop)

Abre **Cocina** de Punto Azul (PIN `1234`). Es la pantalla que va en una tablet
o una TV colgada en el pase.

- Tu pedido ya está ahí, en la columna **Nuevos**. Llegó solo, sin recargar.
- Fíjate en el cronómetro de cada comanda: cambia de color cuando el plato lleva
  demasiado esperando.
- Avánzalo: **Empezar** → **Listo** → **Entregar**.
- Mira el celular sin tocarlo: el estado cambió solo.
- El pedido entregado no desaparece: baja a **Entregados hoy**, con la hora de
  salida. Así la cocina responde "¿la mesa 4 ya tiene su plato?" sin preguntarle
  a nadie. Si lo entregaste por error, **↩ Volver a listo**.

### 3 · Eres la caja

Abre **Caja** de Punto Azul.

- El pedido sale resaltado: el cliente dice que ya pagó, pero nadie lo ha
  comprobado todavía.
- Toca **Confirmar pago recibido ✓** (aquí es donde el cajero mira su celular y
  ve que el yapeo llegó de verdad).
- En el celular del cliente el pago queda confirmado.
- Abajo aparece **Cobrados hoy**, con la hora, el método y el total del día. Lo
  cobrado no se borra de la pantalla: es lo que la caja necesita para cuadrar.

### 4 · Eres el mozo (el salón)

Abre **Salón** de Punto Azul. Son las 10 mesas del local de un vistazo.

- Las mesas donde nadie pidió están en gris (**Libre**). Las demás llevan el color
  de lo que les pasa: pedido nuevo, en cocina, listo para servir, por cobrar.
- Arriba, cuánto hay sin cobrar en el salón ahora mismo.
- El estado sale del pedido: nadie lo escribe a mano. Pide desde el celular y mira
  cómo la mesa cambia sola de color mientras la cocina avanza.
- **Pagar no libera la mesa.** Cuando la caja confirma el cobro, la mesa queda en
  **Cuenta cerrada**: esa gente ya no debe nada, pero sigue sentada con el café, y
  la app no tiene forma de saber que se fue. La mesa solo queda **Libre** cuando
  quien la recoge toca **Liberar mesa**. Es el único dato que le pedimos a una
  persona, porque es el único que la app no puede deducir.

### 5 · Eres el dueño del restaurante

Abre **Administración** de Punto Azul (PIN `1234`).

- **Menú**: cambia el precio de un plato, o márcalo como agotado. Vuelve a la
  carta del cliente y recarga: el cambio ya está.
- **Marca**: cambia el color del local y guarda. La carta entera se retiñe.
- **Mesas y QR**: aquí están los QR que se imprimen y se pegan en cada mesa.
- **Cobros y seguridad**: los números de Yape/Plin del local y los dos PIN.

### 6 · Ahora el otro restaurante

Abre **Cliente · Mesa 1** de **Lanzhou Noodles**. Misma app, y sin embargo: otra
carta, otro color, los platos en chino con la traducción debajo, otros precios.
Eso es lo que compra el restaurante.

Pide algo. Verás que su pedido también es el **#1**: cada local lleva su propia
cuenta y no ve los pedidos del otro.

---

## Qué mirar con ojo crítico

Esto es lo que de verdad nos interesa que nos digas:

- **¿Pedirías así en un restaurante de verdad?** ¿Encontraste rápido lo que
  buscabas en una carta de 113 platos?
- **¿La cocina se entiende de un vistazo?** Imagina el local lleno, con ruido, y
  un cocinero que mira la pantalla dos segundos.
- **¿Confiarías en pagar por aquí?** Qué te faltó ver para fiarte.
- **¿Está bien traducido?** Sobre todo el chino de cocina y caja: son las dos
  pantallas que alguien mira con prisa y sin tiempo de descifrar nada.
- **¿Qué hiciste que no funcionó como esperabas?**

## Lo que todavía no está

Para que no lo busques:

- **El pago no es real.** Hoy el cliente yapea por su cuenta y avisa; la caja lo
  confirma a mano. La pasarela de verdad (Culqi, Izipay, Mercado Pago) viene
  después.
- **No hay boleta ni factura** (SUNAT) todavía.
- **La carta no se traduce sola.** La interfaz está en tres idiomas, pero los nombres
  y descripciones de los platos son los que escribió el restaurante. Que el dueño
  pueda escribir su carta en dos idiomas a la vez es lo siguiente.
- **No se puede llamar al mozo** desde la app.
- Los pedidos que dejes **se borran** cada vez que la demo se reinicia.
- Si la demo llevaba rato sin visitas, el primer acceso tarda ~30 segundos en
  despertar. Es el plan gratuito del hosting, no la app.
