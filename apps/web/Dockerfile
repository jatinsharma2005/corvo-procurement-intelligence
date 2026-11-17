FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @corvo/shared-types build
RUN pnpm --filter @corvo/policy-schema build
RUN pnpm --filter @corvo/web build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000"]
