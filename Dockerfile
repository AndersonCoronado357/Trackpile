# Trackpile en produccion: un solo proceso.
#
# El Express compilado sirve tambien el frontend ya construido, asi que no hace
# falta ni dev-server ni proxy: todo sale por el mismo puerto.

FROM node:22-bookworm-slim

WORKDIR /app

# Las dependencias primero y por separado: mientras no cambien los package.json,
# esta capa se reaprovecha y el build no vuelve a bajar nada.
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install --legacy-peer-deps --prefix backend \
 && npm install --legacy-peer-deps --prefix frontend

COPY . .

# Angular a dist/frontend/browser y TypeScript del backend a backend/dist.
RUN npm --prefix frontend run build \
 && npm --prefix backend run build

# 0.0.0.0 o el contenedor no acepta nada de fuera.
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
