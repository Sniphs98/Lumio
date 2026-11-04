# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:26-alpine AS build
# Node 25 and later no longer ship Corepack, which installs the pnpm version from package.json.
RUN npm install --global corepack@latest && corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @lumio/web
COPY apps/web apps/web
# Building loads the server code, which checks that the required variables are set (src/env.ts).
# These placeholders only satisfy that check: the variables are read again when the app starts.
RUN DATABASE_URL=postgres://build@localhost/build ORIGIN=http://localhost:3000 \
	BETTER_AUTH_SECRET=build-only-placeholder LIVEKIT_URL=ws://localhost:7880 \
	LIVEKIT_API_KEY=build LIVEKIT_API_SECRET=build \
	pnpm --filter @lumio/web build

FROM node:26-alpine
WORKDIR /app
# Uploads arrive in 8 MB pieces (UPLOAD_CHUNK_SIZE), so allow request bodies a bit larger than that.
ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=16M UPLOAD_DIR=/app/data/uploads
COPY --from=build /repo/node_modules /node_modules
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/build ./build
COPY --from=build /repo/apps/web/drizzle ./drizzle
COPY --from=build /repo/apps/web/scripts ./scripts
COPY apps/web/package.json ./
EXPOSE 3000
# Reports the container as unhealthy when the app does not answer or cannot reach its database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# exec hands the process over to Node, so it receives the stop signal and shuts down cleanly.
CMD ["sh", "-c", "node scripts/migrate.js && exec node build"]
