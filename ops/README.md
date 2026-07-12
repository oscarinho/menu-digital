# ops · material de trabajo

Nada de aquí forma parte del producto ni entra en la imagen Docker (`.dockerignore`
excluye la carpeta). Es el taller: lo que se usó para armar la carta y el arte.

| Carpeta | Qué hay |
| --- | --- |
| `prompts-imagenes/` | CSV (`filename, subject, format, prompt`) para generar imágenes en lote, en rondas de 10. `punto-azul-*` son las fotos de los platos; `vectaryx-arte-*`, el arte genérico de la app. Los regeneran `scripts/export-punto-azul-csv.mjs` y `scripts/export-arte-app-csv.mjs`. |
| `arte-generado/` | Las imágenes que devolvió el generador, ya renombradas. En `_revisar/` están las que no pude identificar con certeza. |
| `screenshots/` | Capturas de la carta original de Punto Azul, usadas como referencia. |
| `carta-punto-azul.pdf` | La carta que compró el cliente; de ahí salieron los ingredientes y la sección de bar. |

Las fotos que **sí** usa la app viven en `data/uploads/` (y en `demo/uploads/` para
la demo pública), con nombres `uuid.webp` que referencia la base de datos.
