# Pruebas pendientes — antes de seguir con 1B

Lo construido esta sesión, para tocarlo a mano. Marca `[x]` lo que funcione y
apunta al lado lo que no. Lo divido por **dónde** hay que probarlo, porque la
mitad solo se ve de verdad en un celular o una tablet, no en la laptop.

Dos sitios:
- **Local**: `http://localhost:3100` (lo último, sin riesgo de publicar nada).
- **Demo pública**: `https://vectaryx-demo.onrender.com` (lo que ya está en Render).

PIN del personal y del dueño en la demo: **`1234`**.

---

## 1 · Lo que YO no pude verificar (máxima prioridad)

Esto es lo que ninguna comprobación desde el código alcanza: hay que hacerlo en
un aparato de verdad.

- [ ] **Instalar un local como app (celular).** Abre `…/punto-azul`, menú del
      navegador → *Añadir a pantalla de inicio*. Debe quedar un icono con el
      color y las iniciales del restaurante (azul "PA", verde "LN").
- [ ] **Abrir desde el icono.** Al tocarlo, la app abre a pantalla completa:
      **sin barra de direcciones, sin pestañas, sin el buscador de Google**. Esto
      es lo que separa "una web que me pasaron" de "el sistema del local".
- [ ] El icono NO son cuadraditos vacíos (fue un bug; ya arreglado, pero
      confírmalo en TU aparato, no en el mío).
- [ ] **Instalar la cocina aparte.** `…/cocina/punto-azul` también se instala, y
      su título bajo el icono dice "Cocina · Punto Azul", no "Vectaryx".
- [ ] **Dos idiomas a la vez, dos aparatos.** Pon la cocina en 中文 en la tablet;
      abre la caja en el celular y debe seguir en español. Cada pantalla recuerda
      el suyo.

---

## 2 · La carta del comensal (celular)

`…/r/punto-azul/mesa/1`

- [ ] **El buscador.** Escribe "ceviche": la carta entera se vuelve una sola
      lista, sin importar la categoría. Borra y vuelve a las categorías.
- [ ] Buscar algo que no existe ("pizza") muestra el mensaje de "no encontramos
      ese plato", no una lista vacía y muda.
- [ ] El buscador en inglés y en chino (搜索菜品) también filtra.
- [ ] Los botones **−/+** del carrito son iconos, no los caracteres sueltos.
- [ ] Agregar platos, abrir "Ver pedido", enviar con Yape → cae en seguimiento.
- [ ] **Lanzhou**: los nombres siguen en chino con la traducción debajo, se
      ponga la interfaz en el idioma que se ponga.

---

## 3 · Las pantallas del personal (laptop o tablet)

Entra por la puerta del local (`…/punto-azul`) y navega con la barra de arriba.

- [ ] **Se siente una sola app**: la barra de arriba es la misma en cocina, caja,
      salón y admin, y se salta de una a otra sin escribir la URL.
- [ ] La cabecera dice **"Punto Azul"** con su logo, no "punto-azul".
- [ ] **Cocina**: pide desde el celular y mira caer la comanda. El número de mesa
      es lo más grande; la cantidad va en su caja de color antes del plato. Un
      solo botón grande avanza el pedido. El cronómetro cambia de color al pasar
      el tiempo.
- [ ] **Caja**: las dos cifras del día arriba (por cobrar / cobrado). Marca
      "Ya pagué" desde el celular y mira cómo esa cuenta se resalta en ámbar.
      Cobra y baja a "Cobrados hoy".
- [ ] **Salón**: la mesa con algo que hacer se tiñe de su color; la libre se
      apaga. De lejos se lee como un mapa. "Liberar mesa" cuando hay cuenta
      cerrada.
- [ ] Los iconos de todas son de trazo, no emojis.

---

## 4 · Administración (dueño, PIN 1234)

`…/admin/punto-azul` — aquí estaba lo más "alfa", ojo con esto.

- [ ] **Cambiar un precio NO abre el cuadro gris del navegador.** Tocas el precio,
      se vuelve un campo ahí mismo. Enter guarda, Esc cancela.
- [ ] **Borrar un plato pregunta en una ventana de la app** (con la marca del
      local), no en el `confirm()` del sistema.
- [ ] El admin lleva la misma barra que cocina/caja/salón: es parte de la app,
      no una isla con su propia pantalla.
- [ ] Cambiar el color de la marca tiñe el panel en vivo, antes de guardar.
- [ ] Subir una foto a un plato; si falla, el aviso sale dentro de la app.

---

## 5 · Producto vs. demo

- [ ] **`/`** es la portada de producto (titular, "Ver cómo funciona"), NO el
      índice de dos restaurantes.
- [ ] **`/demo`** es el índice de la prueba, con las dos puertas.
- [ ] La portada está en los tres idiomas (cambia arriba a la derecha).
- [ ] `/plataforma` sigue existiendo pero **no se enlaza desde ninguna pantalla
      pública** (hay que saber la URL).

---

## Lo que ya verifiqué yo (no hace falta repetir, salvo que dudes)

- Aislamiento entre locales, día de negocio por zona horaria y flujo del pedido:
  **25 tests automáticos** (`npm test`). No se rompe sin que salte.
- Las rutas nuevas responden y compilan (`npm run build`, 25 rutas).
- El icono del local dibuja las iniciales en producción (reproducido dentro de la
  imagen de Render: 3177 píxeles de tinta vs. 72 del cuadro vacío).
- Las cadenas en chino del selector de idioma y del buscador están en el bundle
  desplegado.

---

## Al terminar

Apunta abajo lo que falle y seguimos con **1B (modos de servicio)**: el local sin
mozos, la pantalla de despacho para la TV y el pedido de mostrador.

### Fallos encontrados

_(escribe aquí)_
