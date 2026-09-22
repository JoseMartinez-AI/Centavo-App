FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias e instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/
COPY README.md AGENTS.md ./

# Variables de entorno por defecto
ENV PORT=4002
ENV NODE_ENV=production

EXPOSE 4002

CMD ["node", "src/server.js"]
