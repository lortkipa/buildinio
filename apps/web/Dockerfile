# Production image for the web app. Build from the repo root:
#   docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Keep only the files the web app needs, so unrelated changes don't bust the cache.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2 prune @buildinio/web --docker

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter=@buildinio/web

# Next's standalone output carries its own minimal node_modules.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
