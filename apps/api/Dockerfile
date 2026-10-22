# Production image for the API. Build from the repo root:
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Keep only the files the API needs, so unrelated changes don't bust the cache.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2 prune @buildinio/api --docker

FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter=@buildinio/api

# tsup bundles all dependencies, so the runtime image needs no node_modules.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
