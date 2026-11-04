# Running Lumio behind your own reverse proxy

`docker-compose.yml` ships its own Caddy that takes ports 80 and 443 and gets certificates by
itself. If the server already runs a reverse proxy (nginx, Traefik, Caddy, Nginx Proxy Manager,
...), use `docker-compose.proxy.yml` instead. It starts the same app, Postgres and LiveKit, but no
Caddy, and publishes the app on `127.0.0.1:3000` for your proxy.

| File                    | For                                          |
| ----------------------- | -------------------------------------------- |
| `nginx.conf`            | nginx on the host                            |
| `Caddyfile`             | a Caddy on the host                          |
| `traefik.compose.yml`   | Traefik in Docker (labels for the app)       |
| `traefik-livekit.yml`   | Traefik file provider entry for LiveKit      |

## Setup

1. Point both domains (`LUMIO_DOMAIN` and `LIVEKIT_DOMAIN`) at the server, or see
   [one domain](#one-domain-for-both) below.
2. Copy `deploy/.env.example` to `.env` in the repository root, fill it in and add
   `COMPOSE_FILE=docker-compose.proxy.yml`, so that plain `docker compose` uses it.
3. Start Lumio: `docker compose up -d`. The app container reports itself healthy once it
   answers on `/api/health`.
4. Copy the example for your proxy, replace `chat.example.com` and `rtc.example.com` with your
   domains and reload the proxy.
5. Open `80/tcp` and `443/tcp` for the proxy, and `7881/tcp`, `3478/udp` and `50000-60000/udp`
   for LiveKit media. Do **not** open `3000` and `7880`: only the proxy talks to them. LiveKit
   runs on the host network, so `7880` listens on every interface; block it in the firewall.

Switching an existing install from the bundled Caddy: run `docker compose down`, add
`COMPOSE_FILE=docker-compose.proxy.yml` to `.env` and run `docker compose up -d`. Both files
use the same volumes, so messages, files and accounts stay.

## What the proxy has to do

The examples already do all of this; check these points when you write your own config.

- **HTTPS.** Browsers only allow microphone, camera and screen sharing on HTTPS. `ORIGIN` is
  `https://LUMIO_DOMAIN` and must match the address people open: SvelteKit refuses form posts
  from any other origin, and sign-in links are built from it.
- **Host and client address.** Pass the `Host` header on and append the client's address to
  `X-Forwarded-For`. Lumio uses the address for its sign-in and sign-up limits and reads the
  last `XFF_DEPTH` entries of the header (default 1, one proxy). With another proxy or a CDN in
  front of yours, raise `XFF_DEPTH` by one for each, or set `ADDRESS_HEADER` to a header that
  holds only the client's address, e.g. `CF-Connecting-IP` behind Cloudflare.
- **Live updates.** Messages, typing and voice state arrive as Server-Sent Events on
  `/api/.../events`. The proxy must not buffer these responses and must keep them open; the app
  sends a heartbeat every 25 seconds. In nginx that is `proxy_buffering off`.
- **Uploads.** Files are uploaded in 8 MB pieces, so allow request bodies of at least 16 MB
  (`client_max_body_size 16m` in nginx).
- **LiveKit.** Forward `LIVEKIT_DOMAIN` to `127.0.0.1:7880` with WebSocket upgrades
  (`Upgrade` and `Connection` headers) and a long read timeout. Audio, video and screen sharing
  go directly to LiveKit over UDP and never pass through the proxy.

Lumio has to be served from the root of its domain; a sub-path such as
`example.com/lumio/` is not supported.

## One domain for both

LiveKit can also be served from a path of the app domain, so you need only one domain and
certificate. Set `LIVEKIT_URL=wss://chat.example.com/livekit` in `.env` and have the proxy
forward `/livekit/` to `127.0.0.1:7880` with the prefix removed. The nginx and Caddy examples
contain this block, commented out.

## Traefik

When Traefik runs in Docker, add `traefik.compose.yml` on top:

```sh
COMPOSE_FILE=docker-compose.proxy.yml:deploy/reverse-proxy/traefik.compose.yml
```

It joins the app to Traefik's network (`TRAEFIK_NETWORK`, default `proxy`) and sets the router
labels for `LUMIO_DOMAIN`; `TRAEFIK_ENTRYPOINT` and `TRAEFIK_CERT_RESOLVER` default to
`websecure` and `letsencrypt`. LiveKit uses the host network, which Docker labels cannot route
to, so put `traefik-livekit.yml` into the directory of Traefik's file provider and give the
Traefik container `extra_hosts: ['host.docker.internal:host-gateway']`.

## Testing a setup

`/api/health` answers `{"status":"ok"}` when the app runs and reaches its database, and 503
otherwise. `https://LIVEKIT_DOMAIN/` answers `OK` when LiveKit is reachable through the proxy.

CI runs `.github/scripts/reverse-proxy-test.sh` on every pull request: it starts the image with
`docker-compose.proxy.yml` behind `nginx.conf` and checks the redirect to HTTPS, the health
check, form posts and the LiveKit WebSocket. Run it locally after building the image:

```sh
docker build -f apps/web/Dockerfile -t ghcr.io/sniphs98/lumio:ci .
LUMIO_IMAGE=ghcr.io/sniphs98/lumio:ci .github/scripts/reverse-proxy-test.sh
```
