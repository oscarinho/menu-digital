# Imagen de producción de Vectaryx Pedidos en Mesa.
# node:24-slim (glibc) para que better-sqlite3 use sus binarios precompilados.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
RUN npm prune --omit=dev
# La base SQLite y las fotos viven en /app/data; en producción se monta un
# volumen ahí (docker-compose.yml ya lo hace).
#
# El arranque por defecto NO siembra nada. En el primer despliegue de un cliente
# el volumen está vacío, y sembrarlo con el snapshot de la demo le metería la
# carta de Punto Azul y el PIN público 1234 en su propia base. La demo sobrescribe
# el comando con `npm run demo:start` (ver render.yaml).
EXPOSE 3000
CMD ["npm", "start"]
