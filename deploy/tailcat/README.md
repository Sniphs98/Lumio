# Guests through tailcat (experimental)

[tailcat](https://github.com/tailscale/tailcat) builds an encrypted tunnel between two machines
over Tailscale's open source data plane, without a Tailscale account. With it, guests can join a
Lumio server that has no public IP address and no open ports, for example one at home behind
CGNAT. It is a prototype: it works only in the **desktop app**, not in browsers or on phones,
and the guest needs tailcat installed.

## How it works

```
Guest's desktop app                              Lumio server
  window -- HTTPS --> local proxy --+                       +--> :443  reverse proxy --> app, LiveKit
                                    +-- tailcat tunnel -----+
  WebRTC -- TURN/TCP --> :3479 -----+                       +--> :3479 TURN (coturn) --> LiveKit
```

- The server runs `tailcat serve 443,3479`. Only those two ports are reachable through the
  tunnel: the reverse proxy (app and LiveKit signaling) and a TURN server.
- The desktop app runs `tailcat forward <address> 0:443 3479` and a small local proxy. Every
  HTTPS connection of the window goes through it into the tunnel, so the guest needs no DNS
  record for the server. Certificates are checked as usual.
- The tunnel carries only TCP, so calls cannot use LiveKit's UDP ports. LiveKit tells every
  participant about a TURN server at `127.0.0.1:3479` over TCP, which on the guest's machine is
  the tunnel. WebRTC relays the call through it. Browsers that are not on tailcat find nothing
  there and use the normal media ports.
- tailcat connects the two machines directly when it can. Otherwise traffic goes through
  Tailscale's shared relays, which are rate limited: chat works, but video and screen sharing
  may stutter. You can [run your own relay](https://github.com/tailscale/tailcat#bring-your-own-derp-relay).

## Server setup

1. Set up Lumio as usual with `docker-compose.yml` (or `docker-compose.proxy.yml`). Both
   domains need a **valid certificate**. Without a public IP, Caddy cannot get one with the
   default HTTP challenge; use the DNS challenge of your DNS provider instead, or a certificate
   from somewhere else.
2. Add to `.env`:

   ```sh
   COMPOSE_FILE=docker-compose.yml:docker-compose.tailcat.yml
   # Generate with: openssl rand -hex 32
   LUMIO_TURN_SECRET=
   # This server's address in its local network, e.g. 192.168.1.20
   LUMIO_TURN_RELAY_IP=
   ```

   With your own reverse proxy use `docker-compose.proxy.yml:docker-compose.tailcat.yml`. The
   proxy must listen on port 443 of this machine.

3. Create the tailcat key once, so that the address stays the same across restarts:

   ```sh
   docker compose run --rm tailcat genkey --key=default
   ```

   It prints the server's tailcat address (`tc...`).

4. Start everything: `docker compose up -d`. `docker compose logs tailcat` shows the address
   again.

Give guests the address of the server (or an invite link) and the tailcat address. **The
tailcat address is a secret**: whoever has it can reach ports 443 and 3479 of the server. To
lock out everybody who ever got it, delete the key with
`docker compose run --rm tailcat genkey --delete --key=default`, create a new one and restart.

## Guest setup

1. Install tailcat: `brew install tailcat` (macOS), `scoop install tailcat` (Windows), or a
   binary from the [releases](https://github.com/tailscale/tailcat/releases) (Linux, Windows).
   The app finds it on the `PATH`; set `LUMIO_TAILCAT` to its full path otherwise.
2. Start the Lumio desktop app, enter the server address or invite link and the tailcat
   address, and connect.

Port 3479 must be free on the guest's machine.

## Troubleshooting

- On the guest, run `tailcat ping --until-direct <address>` to see whether the connection is
  direct or goes through a shared relay.
- Calls connect but stay silent: check that `LUMIO_TURN_RELAY_IP` is the address LiveKit runs on
  and that `docker compose logs turn` shows allocations.
