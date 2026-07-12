// Restaura el estado de la demo antes de arrancar el servidor.
//
// El hosting gratuito (Render free) no tiene disco persistente: cada reinicio
// borra /app/data. Este script copia el snapshot versionado de demo/ (carta de
// Punto Azul + fotos) a data/, de modo que la demo siempre despierta limpia:
// sin pedidos de prueba acumulados y con todas las fotos en su sitio.
//
// - Sin --force: sólo siembra si data/menu.db no existe (no pisa datos vivos).
// - Con --force (npm run demo:reset): reemplaza siempre.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const snapshot = path.join(root, "demo");
const data = path.join(root, "data");
const force = process.argv.includes("--force");

// Segundo cerrojo, además del CMD del Dockerfile: aunque alguien arranque un
// servidor de producción con demo:start, sin VECTARYX_DEMO=1 no se le siembra la
// carta de Punto Azul (ni el PIN público 1234) en la base de su cliente.
if (!force && process.env.VECTARYX_DEMO !== "1") {
  console.log("[demo-boot] No es la demo (VECTARYX_DEMO != 1): no siembro nada.");
  process.exit(0);
}

if (!existsSync(path.join(snapshot, "menu.db"))) {
  console.log("[demo-boot] No hay snapshot en demo/ — arranco con la base vacía.");
  process.exit(0);
}

if (existsSync(path.join(data, "menu.db")) && !force) {
  console.log("[demo-boot] Ya hay una base en data/ — la respeto.");
  process.exit(0);
}

if (force && existsSync(data)) {
  // Los -wal/-shm de una sesión anterior corromperían la base recién copiada.
  rmSync(data, { recursive: true, force: true });
}
mkdirSync(path.join(data, "uploads"), { recursive: true });
cpSync(path.join(snapshot, "menu.db"), path.join(data, "menu.db"));
cpSync(path.join(snapshot, "uploads"), path.join(data, "uploads"), { recursive: true });
console.log(`[demo-boot] Demo restaurada en ${data}`);
