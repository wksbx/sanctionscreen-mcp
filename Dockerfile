# Stage 1: Build
FROM node:22.22.2-alpine3.22 AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2: Production
FROM node:22.22.2-alpine3.22

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/.well-known/oauth-protected-resource || exit 1

CMD ["node", "dist/main.js"]
