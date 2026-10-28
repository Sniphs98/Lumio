# Lumio

A self-hosted chat app for you and your friends: text channels, voice, video and screen sharing, with a cleaner UI than Discord.

Lumio runs in the browser (desktop and mobile, installable as a PWA), and there is an optional Electron desktop app. Nothing has to be installed to use it.

> **Status:** early. Sign up, invite links, text channels, file sharing, friends, direct messages, voice channels and calls (with camera and screen sharing) work.

## Stack

| Part | Choice |
| --- | --- |
| Web app | [SvelteKit](https://svelte.dev/docs/kit) + [shadcn-svelte](https://shadcn-svelte.com) + Tailwind CSS |
| Auth | [Better Auth](https://www.better-auth.com) (email and password) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Voice, video, screen sharing | [LiveKit](https://livekit.io) (self-hosted SFU) |
| Desktop | Electron, a thin shell around the web app |
| Deployment | Docker Compose + Caddy (automatic HTTPS) |

## Repository layout

```
apps/
  web/        SvelteKit app: UI, API, auth, database schema and migrations
  desktop/    Electron shell (asks for the server URL on first start)
deploy/       Caddyfile, LiveKit config, production .env template
docker-compose.yml       production setup
docker-compose.dev.yml   Postgres + LiveKit for local development
```

## Development

Requirements: Node.js 22+, pnpm 10+, Docker.

```sh
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres + LiveKit
cp apps/web/.env.example apps/web/.env            # set BETTER_AUTH_SECRET
pnpm db:migrate
pnpm dev                                          # http://localhost:5173
```

Desktop app against the local dev server:

```sh
LUMIO_URL=http://localhost:5173 pnpm desktop
```

### Tests

```sh
pnpm test:unit   # Vitest: unit tests and component tests in a real browser
pnpm test:e2e    # Playwright: end-to-end tests, needs the dev Postgres and a migrated database
```

Run `pnpm --filter @lumio/web exec playwright install chromium` once to download the browser. Before the end-to-end tests run, `apps/web/e2e/setup.ts` creates the server owner on an empty database and a shared invite link (valid for one day) that the test users sign up with. CI runs lint, type checks, unit and end-to-end tests on every pull request.

### AI coding tools

The repository is set up for Claude Code (and other agents that read `AGENTS.md`): `CLAUDE.md` holds the project rules, `.mcp.json` connects the official [Svelte MCP server](https://svelte.dev/docs/mcp), and `.claude/` contains the Svelte skills and a Svelte file editor agent from the Svelte CLI.

### Database changes

Edit `apps/web/src/lib/server/db/schema.ts`, then run `pnpm db:generate` to create a migration in `apps/web/drizzle/` and `pnpm db:migrate` to apply it. The Better Auth tables live in `auth.schema.ts` and are generated with `pnpm --filter @lumio/web auth:schema`.

### UI components

shadcn-svelte components live in `apps/web/src/lib/components/ui`. This project uses SvelteKit's `#lib` import alias with explicit file extensions, so after adding a component with `npx shadcn-svelte add <name>` change its `#lib/utils` import to `#lib/utils.ts`.

## Self-hosting

You need a VPS with a public IP (2 vCPU and 4 GB RAM are enough for a group of friends) and two domains pointing to it, one for the app and one for LiveKit.

```sh
git clone https://github.com/Sniphs98/Lumio.git && cd Lumio
cp deploy/.env.example .env    # fill in domains and secrets
docker compose up -d
```

Open the app and create an account: the first account becomes the owner of the server. After that, registration is closed and people join through invite links. Create one under **Invite people** in the server tab, choose how long it stays valid and how often it can be used, and send it to your friends. Links can be revoked there at any time.

Open these ports in your firewall: `80/tcp`, `443/tcp+udp` (HTTPS), `7881/tcp`, `3478/udp` and `50000-60000/udp` (LiveKit media). Missing UDP ports are the most common reason calls do not connect.

Browsers only allow microphone, camera and screen access on HTTPS (or `localhost`), so calls need the HTTPS setup above. Screen sharing works in desktop browsers and the desktop app; most mobile browsers can join calls but cannot share their screen.

### File sharing

Members can share files in channels and direct messages with the paperclip button, by dropping them onto the chat or by pasting them. Images, videos and audio play inline, everything else is a download. Large files are uploaded in 8 MB pieces with the [tus](https://tus.io) protocol, so a dropped connection resumes where it stopped. The default limit is 2 GB per file; the owner (and anyone with **Manage server**) can change it under **Server settings** in the server tab.

Files are stored on the server in the `uploads` Docker volume. To keep them in S3 or an S3-compatible service (Cloudflare R2, MinIO, ...) instead, set `S3_BUCKET` and its credentials in `.env` (see `deploy/.env.example`). Uploads that were never sent are deleted after a day.

### Tracing

Lumio can send [OpenTelemetry](https://opentelemetry.io) traces, which help to find slow requests and errors. It is off by default and costs nothing while off. SvelteKit records a span for every request, `handle` hook, `load` function, form action and `+server` handler; failed ones are marked as errors with the exception attached. Database queries do not get their own spans yet.

To turn it on, set `OTEL_EXPORTER_OTLP_ENDPOINT` to any OTLP/HTTP receiver (Jaeger, Grafana Tempo, an OpenTelemetry Collector, ...). The other standard variables work too, for example `OTEL_SERVICE_NAME` (default `lumio`), `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_RESOURCE_ATTRIBUTES`.

The compose files ship an optional Jaeger in the `tracing` profile:

- **Development:** run `docker compose -f docker-compose.dev.yml --profile tracing up -d`, set `OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"` in `apps/web/.env` and open http://localhost:16686.
- **Self-hosted:** add `COMPOSE_PROFILES=tracing` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318` to `.env`, run `docker compose up -d`, and open the UI through an SSH tunnel: `ssh -L 16686:localhost:16686 your-server`, then http://localhost:16686. Jaeger keeps traces in memory, so they are gone after a restart.

## Roadmap

1. **MVP:** servers with invite links, text channels, real-time chat over WebSockets, file uploads, voice channels, screen sharing, simple roles, friends and direct chats with calls.
2. **Comfort:** group chats, reactions, replies, mentions, unread markers, per-channel permissions, webcam, search, notifications.
3. **Later:** threads, custom emoji, bots and webhooks, end-to-end encrypted direct messages, federation.

## License

[AGPL-3.0](LICENSE). If you run a modified version of Lumio for others, you must publish your changes.
