# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @lumio/web
COPY apps/web apps/web
RUN pnpm --filter @lumio/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /repo/node_modules /node_modules
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/build ./build
COPY --from=build /repo/apps/web/drizzle ./drizzle
COPY --from=build /repo/apps/web/scripts ./scripts
COPY apps/web/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
