FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @corvo/shared-types build
RUN pnpm --filter @corvo/policy-schema build
RUN pnpm --filter @corvo/api build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/policy-schema/dist ./packages/policy-schema/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
