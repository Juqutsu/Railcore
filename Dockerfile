# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
# Prisma's schema engine (used by migrations) needs OpenSSL to pick the right binary.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# `prisma generate` never connects, but prisma.config.ts requires a URL to be set.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build && npm prune --omit=dev

FROM node:24-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
USER node
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/index.js"]
