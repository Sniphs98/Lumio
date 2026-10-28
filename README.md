# Lumio

A self-hosted chat app for you and your friends: text channels, voice, video and screen sharing, with a cleaner UI than Discord.

Lumio runs in the browser (desktop and mobile, installable as a PWA), and there is an optional Electron desktop app. Nothing has to be installed to use it.

> **Status:** early scaffold. Sign up, sign in and the app shell work; chat, voice and servers are next.

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

Run `pnpm --filter @lumio/web exec playwright install chromium` once to download the browser. CI runs lint, type checks, unit and end-to-end tests on every pull request.

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

Open these ports in your firewall: `80/tcp`, `443/tcp+udp` (HTTPS), `7881/tcp`, `3478/udp` and `50000-60000/udp` (LiveKit media). Missing UDP ports are the most common reason calls do not connect.

## Roadmap

1. **MVP:** servers with invite links, text channels, real-time chat over WebSockets, file uploads, voice channels, screen sharing, simple roles, friends and direct chats with calls.
2. **Comfort:** group chats, reactions, replies, mentions, unread markers, per-channel permissions, webcam, search, notifications.
3. **Later:** threads, custom emoji, bots and webhooks, end-to-end encrypted direct messages, federation.

## License

[AGPL-3.0](LICENSE). If you run a modified version of Lumio for others, you must publish your changes.
