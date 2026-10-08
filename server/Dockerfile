# API NestJS — image de production multi-étapes.
# Build : docker build -t fixeo-api ./server
# Les secrets (DATABASE_URL, JWT_SECRET…) sont fournis au lancement, jamais copiés dans l'image.

FROM node:24-slim AS base
# Prisma a besoin d'OpenSSL pour son moteur de requêtes.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1. Dépendances complètes (dev incluses) pour compiler.
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# 2. Dépendances de production uniquement + client Prisma généré.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# 3. Image finale : uniquement le code compilé et les dépendances de prod.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
