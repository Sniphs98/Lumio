# Lumio

A self-hosted chat app for you and your friends: text channels, voice, video and screen sharing, with a cleaner UI than Discord.

Lumio runs in the browser (desktop and mobile, installable as a PWA), and there is an optional Electron desktop app. Nothing has to be installed to use it.

> **Status:** early. Sign up, invite links, guest access, text channels, file sharing, friends (added through personal friend links), direct messages, group chats, voice channels and calls (with camera and screen sharing) work. Everyone can set a profile picture, groups and the server can have a picture too. Messages support emoji reactions, replies and @-mentions, and unread counters show up on channels, chats and tabs. Moderators can kick and ban people and delete messages, and the owner sets limits for storage and for who may invite people.

## Stack

| Part                         | Choice                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Web app                      | [SvelteKit](https://svelte.dev/docs/kit) + [shadcn-svelte](https://shadcn-svelte.com) + Tailwind CSS |
| Auth                         | [Better Auth](https://www.better-auth.com) (email and password, optional Discord, Google and Steam)  |
| Database                     | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)                                                 |
| Voice, video, screen sharing | [LiveKit](https://livekit.io) (self-hosted SFU)                                                      |
| Desktop                      | Electron, a thin shell around the web app                                                            |
| Deployment                   | Docker Compose + Caddy (automatic HTTPS)                                                             |

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

The dev LiveKit server announces `127.0.0.1` as its media address, so calls work when the browser runs on the same machine, including Docker Desktop and WSL. To join calls from another device in your network (for example a phone), put `LIVEKIT_NODE_IP=<your LAN IP>` into a `.env` file in the repository root, restart LiveKit with `docker compose -f docker-compose.dev.yml up -d livekit` and set `LIVEKIT_URL` in `apps/web/.env` to `ws://<your LAN IP>:7880`. Browsers only allow microphone and camera access on HTTPS or `localhost`, so other devices can join calls but may not be able to send audio or video.

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

### Releases

Every push to `main` is released automatically (`.github/workflows/release.yml`): once CI has passed, the workflow works out the next version, builds the image for amd64 and arm64, pushes it to `ghcr.io/sniphs98/lumio` and creates a GitHub release with a tag and generated notes. The release notes show the `docker pull` command, and the image is attached for amd64 and arm64 (`docker load -i lumio-<version>-linux-amd64.tar.gz`) for machines that cannot reach ghcr.io.

The version bump comes from the name of the merged pull request's branch:

| Branch                                                            | Bump  | Example             |
| ----------------------------------------------------------------- | ----- | ------------------- |
| `major/…`, `breaking/…`                                           | major | `v0.4.2` → `v1.0.0` |
| `feat/…`, `feature/…`, `minor/…`                                  | minor | `v0.4.2` → `v0.5.0` |
| anything else (`fix/…`, `chore/…`, `dependabot/…`, direct pushes) | patch | `v0.4.2` → `v0.4.3` |

A label on the pull request overrides the branch name, for branches whose name cannot be chosen: `release:major`, `release:minor`, `release:patch`, or `release:skip` to merge without a release. If several pull requests land before a release runs, the highest bump wins. The rules live in `.github/scripts/next-version.sh` and are tested by `next-version.test.sh` in CI.

A version tag pushed by hand also starts a release, after running the full CI:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

Every commit on `main` that passes CI is also published as `edge` and `sha-<commit>` (`LUMIO_VERSION=edge`), even when it is not released. Pull requests build the image too and test it behind the example nginx config, see [deploy/reverse-proxy](deploy/reverse-proxy/README.md#testing-a-setup).

`v1.2.3` is published as `1.2.3`, `1.2`, `1` and `latest`; for `0.x` versions the major tag is skipped. Pre-releases such as `v0.2.0-beta.1` (only from hand-pushed tags) get just their own tag and are marked as pre-release.

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

This pulls the released image `ghcr.io/sniphs98/lumio` (amd64 and arm64). To run your own changes instead, build it from the checkout with `docker compose up -d --build`.

Open the app and create an account: the first account becomes the owner of the server. After that, registration is closed and people join through invite links. Create one under **Invite people** in the server tab, choose how long it stays valid, how often it can be used and whether guests are allowed, and send it to your friends. Links can be revoked there at any time.

Everyone also has a personal friend link on the Home tab. Whoever opens it becomes their friend right away; newcomers join the server through it first (if its owner may create invites). People joining through a link can create an account or join as a guest with just a name. A guest's session is kept in the browser (cookie and `localStorage`), and when they come back they are asked to create an account: they keep their user, messages, friends and roles, and can then sign in on any device.

Open these ports in your firewall: `80/tcp`, `443/tcp+udp` (HTTPS), `7881/tcp`, `3478/udp` and `50000-60000/udp` (LiveKit media). Missing UDP ports are the most common reason calls do not connect.

Already running nginx, Traefik or another reverse proxy? Use `docker-compose.proxy.yml`, which leaves out Caddy and publishes the app on `127.0.0.1:3000`. Setup, example configs and what the proxy has to forward are in [deploy/reverse-proxy](deploy/reverse-proxy/README.md).

No public IP address, e.g. a server at home behind CGNAT? Guests can join through a [tailcat](https://github.com/tailscale/tailcat) tunnel with the desktop app. This is experimental, see [deploy/tailcat](deploy/tailcat/README.md).

Browsers only allow microphone, camera and screen access on HTTPS (or `localhost`), so calls need the HTTPS setup above. Screen sharing works in desktop browsers and the desktop app; most mobile browsers can join calls but cannot share their screen.

### Updating

```sh
git pull                      # newer Caddy, LiveKit and compose settings
docker compose pull
docker compose up -d
```

Database migrations run automatically when the app starts. By default you get the `latest` release. To stay on a version, set `LUMIO_VERSION` in `.env`: `0.1.0` stays exactly there, `0.1` follows its bug fixes. Release notes are on the [releases page](https://github.com/Sniphs98/Lumio/releases).

### File sharing

Members can share files in channels and direct messages with the paperclip button, by dropping them onto the chat or by pasting them. Images, videos and audio play inline, everything else is a download. Large files are uploaded in 8 MB pieces with the [tus](https://tus.io) protocol, so a dropped connection resumes where it stopped. The default limit is 2 GB per file; the owner (and anyone with **Manage server**) can change it under **Server settings** in the server tab.

Files are stored on the server in the `uploads` Docker volume. To keep them in S3 or an S3-compatible service (Cloudflare R2, MinIO, ...) instead, set `S3_BUCKET` and its credentials in `.env` (see `deploy/.env.example`). Uploads that were never sent are deleted after a day.

Profile pictures, the server icon and group pictures live in the same place, under `images/`. Browsers crop them to a square and scale them down to 512 × 512 before uploading (GIFs are kept as they are, up to 8 MB).

### Sign in with Discord, Google or Steam

People can join and sign in with their Discord, Google or Steam account. Each service is off by default and is turned on with its own credentials in `.env`; services without them show no button. After changing `.env`, restart the app with `docker compose up -d`.

**Discord**

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **OAuth2**, add the redirect `https://<LUMIO_DOMAIN>/api/auth/callback/discord`.
3. Set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to the application's client ID and secret.

**Google**

1. In the [Google Cloud Console](https://console.cloud.google.com), create a project (or pick one) and set up the **OAuth consent screen** (Google Auth Platform): app name, support email, and your domain under **Authorized domains**. Publish the app, otherwise only test users you list can sign in.
2. Under **Clients** (APIs & Services → Credentials), create an **OAuth client ID** of type **Web application**. Add `https://<LUMIO_DOMAIN>` as an authorized JavaScript origin and `https://<LUMIO_DOMAIN>/api/auth/callback/google` as an authorized redirect URI.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the client's ID and secret.

**Steam**

Steam uses OpenID 2.0, not OAuth, so there is no application or redirect to register. Lumio only needs a Steam Web API key to read the display name:

1. Sign in on the [Steam Web API key page](https://steamcommunity.com/dev/apikey) (the Steam account needs to have spent at least 5 USD in the Steam store) and register a key with `<LUMIO_DOMAIN>` as the domain name.
2. Set `STEAM_API_KEY` to that key.

The login, invite and friend link pages then show **Continue with Discord**, **Continue with Google** or **Continue with Steam**. New users still need an invite or friend link (except the first user, who becomes the owner). Lumio takes their display name and, from Discord and Google, their email address, but never their avatar. Steam shares no email address, so Steam users get a placeholder that is never shown.

Members connect more services, or disconnect them, under **Connected accounts** on their **Account** page. A service is never connected because an email address matches, only from that page, and the last way to sign in cannot be disconnected.

### Emojis and GIFs

The smiley button in the composer opens an emoji picker with search, categories and your recently used emojis; the same picker adds reactions to messages. It works without any setup.

Searching and sending GIFs needs a GIPHY API key, so it is off by default. The owner (and anyone with **Manage server**) creates a free key on the [GIPHY developer dashboard](https://developers.giphy.com/dashboard/) and pastes it under **Server settings → GIFs**; Lumio checks it with GIPHY before saving it. Alternatively set `GIPHY_API_KEY` or `TENOR_API_KEY` (a Google Cloud key with the [Tenor API](https://developers.google.com/tenor) enabled) in `.env`; these win over the settings, and Giphy wins when both are set. The composer then gets a **GIF** button. GIFs are loaded through Lumio, so Giphy and Tenor only see the server, not who reads a chat. GIFs that were sent keep showing if the key is removed later.

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
