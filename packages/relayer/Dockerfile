FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ postgresql-dev

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/relayer/package.json ./packages/relayer/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/package.json ./packages/sdk/

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build --filter=@nexora-protocol/shared --filter=@nexora-protocol/relayer

FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/relayer/dist ./packages/relayer/dist
COPY --from=builder /app/packages/relayer/package.json ./packages/relayer/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/pnpm-lock.yaml ./

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/live', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/relayer/dist/index.js"]
