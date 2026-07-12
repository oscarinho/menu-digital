# Despliegue en VPS — Vectaryx Pedidos en Mesa

Guía para poner el piloto en internet con HTTPS en ~20 minutos. Todo el stack
(Next.js + SQLite + fotos + proxy HTTPS) corre en un solo VPS con Docker
Compose. Caddy emite y renueva el certificado TLS automáticamente.

## Requisitos

- VPS Ubuntu 24.04 con 1-2 GB de RAM (DigitalOcean/Vultr, región **São Paulo**
  para buena latencia desde Lima). US$ 6-12/mes.
- Un dominio o subdominio (ej. `app.vectaryx.com`). **Elegirlo bien: los QR
  impresos en las mesas lo llevan para siempre.**

## Paso a paso

### 1. DNS

Crear un registro **A** del dominio → IP del VPS. Esperar a que propague
(`ping app.vectaryx.com` debe responder con la IP del VPS).

### 2. Preparar el VPS (una sola vez)

```bash
ssh root@IP_DEL_VPS

# Docker + utilidades
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker        # arranca solo tras cada reinicio
apt install -y git sqlite3

# Firewall básico
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

> No hace falta una unidad systemd propia: Docker arranca con el sistema y
> `restart: unless-stopped` en el compose relevanta la app si se cae o si el
> VPS se reinicia.

### 3. Subir el código y configurar

```bash
git clone <URL_DEL_REPO> /opt/vectaryx
cd /opt/vectaryx

cp .env.example .env
nano .env    # 1) APP_DOMAIN=tu dominio real
             # 2) VECTARYX_PLATFORM_KEY=$(openssl rand -hex 24)
```

### 4. Levantar (el comando)

```bash
docker compose up -d --build
```

Primera vez tarda unos minutos (construye la imagen). Verificar:

```bash
docker compose ps                  # app y caddy "running"
curl -I https://app.vectaryx.com   # HTTP/2 200 con certificado válido
```

### 5. Backup diario

```bash
chmod +x deploy/backup.sh
crontab -e
# agregar:
0 4 * * * /opt/vectaryx/deploy/backup.sh >> /var/log/vectaryx-backup.log 2>&1
```

Deja en `/opt/vectaryx/backups/` una copia consistente de la base y las fotos,
con 14 días de retención. Ideal además sincronizar esa carpeta fuera del VPS
(rclone a un bucket, o un `scp` desde tu Mac).

### 6. Higiene post-despliegue (¡importante!)

La imagen arranca con `npm start`, que **no siembra nada**: en el servidor de un
cliente la base nace vacía y la carta de la demo nunca llega ahí (sólo la demo
usa `npm run demo:start`). Pero si la base está vacía, la app crea un local de
ejemplo con PIN `1234` en la primera visita. Así que:

1. Entrar a `https://tu-dominio/plataforma` con la clave nueva del `.env`.
2. Dar de alta el restaurante real con **PIN propios y distintos entre sí**: el
   del personal abre cocina y caja; el del dueño abre además la administración.
   Mientras coincidan, cualquiera de la cocina puede cambiar el número de Yape al
   que llega el dinero del local.
3. **Suspender o borrar** el local de ejemplo que haya quedado: su PIN `1234` es
   público.

## Operación diaria

| Acción | Comando (en `/opt/vectaryx`) |
| --- | --- |
| Actualizar la app | `git pull && docker compose up -d --build` |
| Ver logs | `docker compose logs -f app` |
| Reiniciar | `docker compose restart` |
| Restaurar un backup | detener (`docker compose down`), copiar el `.db` del backup a `data/menu.db`, descomprimir uploads, `docker compose up -d` |

## Cuándo salir de este esquema

Este VPS aguanta con holgura el piloto (decenas de locales, polling cada
3-4 s). Migrar a Postgres + blob storage (y ahí sí Vercel u otra nube con
autoescalado) cuando haya cientos de restaurantes o se necesite más de una
instancia. El código ya aísla el acceso a datos en `src/lib/db.ts`, así que la
migración es acotada.
