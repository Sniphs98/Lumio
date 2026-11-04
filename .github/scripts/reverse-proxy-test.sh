#!/usr/bin/env bash
# Starts the Docker image with docker-compose.proxy.yml behind the example nginx config
# (deploy/reverse-proxy/nginx.conf) and checks that the app and LiveKit work through it.
#
#   LUMIO_IMAGE=ghcr.io/sniphs98/lumio:ci .github/scripts/reverse-proxy-test.sh
#
# Needs Docker, curl and openssl, and the ports 80, 443, 3000 and 7880 to be free.
set -euo pipefail

cd "$(dirname "$0")/../.."
image="${LUMIO_IMAGE:?Set LUMIO_IMAGE to the image to test, e.g. ghcr.io/sniphs98/lumio:ci}"
work="$(mktemp -d)"
project=lumio-proxy-test
app=chat.example.com
rtc=rtc.example.com

cat > "$work/.env" <<ENV
LUMIO_VERSION=${image##*:}
LUMIO_DOMAIN=$app
LIVEKIT_DOMAIN=$rtc
POSTGRES_PASSWORD=$(openssl rand -hex 16)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
LIVEKIT_API_KEY=lumio
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
ENV
compose=(docker compose --project-name "$project" --env-file "$work/.env" -f docker-compose.proxy.yml)

cleanup() {
	status=$?
	if [ "$status" -ne 0 ]; then
		"${compose[@]}" logs --tail 100 || true
		docker logs "$project-nginx" || true
	fi
	docker rm -f "$project-nginx" > /dev/null 2>&1 || true
	"${compose[@]}" down --volumes > /dev/null 2>&1 || true
	rm -rf "$work"
	exit "$status"
}
trap cleanup EXIT

if [ "${image%:*}" != "ghcr.io/sniphs98/lumio" ]; then
	echo "LUMIO_IMAGE must be named ghcr.io/sniphs98/lumio:<tag>, as in docker-compose.yml" >&2
	exit 1
fi

echo "Starting Lumio"
# --wait returns once the image's health check reports the app as healthy.
"${compose[@]}" up --detach --no-build --wait --wait-timeout 180

echo "Starting nginx with deploy/reverse-proxy/nginx.conf"
# A self-signed certificate stands in for the Let's Encrypt one.
for domain in "$app" "$rtc"; do
	mkdir -p "$work/certs/$domain"
	openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$domain" \
		-addext "subjectAltName=DNS:$domain" \
		-keyout "$work/certs/$domain/privkey.pem" -out "$work/certs/$domain/fullchain.pem" 2> /dev/null
done
cat "$work/certs/$app/fullchain.pem" "$work/certs/$rtc/fullchain.pem" > "$work/ca.pem"
# CI machines often have no IPv6, so leave out the IPv6 listeners; everything else is as shipped.
grep -v 'listen \[::\]' deploy/reverse-proxy/nginx.conf > "$work/nginx.conf"
docker run --detach --name "$project-nginx" --network host \
	--volume "$work/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
	--volume "$work/certs:/etc/letsencrypt/live:ro" \
	nginx:1.29-alpine > /dev/null
timeout 30 sh -c "until curl --noproxy \"*\" -so /dev/null http://127.0.0.1:80; do sleep 1; done"

request() {
	curl --silent --show-error --noproxy "*" --cacert "$work/ca.pem" \
		--resolve "$app:443:127.0.0.1" --resolve "$rtc:443:127.0.0.1" \
		--resolve "$app:80:127.0.0.1" "$@"
}
failures=0
check() {
	local name="$1" expected="$2" actual="$3"
	if [ "$actual" = "$expected" ]; then
		echo "ok    $name"
	else
		echo "FAIL  $name: expected $expected, got $actual"
		failures=$((failures + 1))
	fi
}

check 'HTTP redirects to HTTPS' 301 \
	"$(request -o /dev/null -w '%{http_code}' "http://$app/")"
check 'health check through the proxy' '{"status":"ok"}' \
	"$(request "https://$app/api/health")"
check 'login page loads' 200 \
	"$(request -o /dev/null -w '%{http_code}' "https://$app/login")"
# SvelteKit rejects form posts whose Origin differs from ORIGIN. Through a correctly set up
# proxy a same-site post gets past that check, while a cross-site one is still refused.
check 'same-site form post is accepted' 400 \
	"$(request -o /dev/null -w '%{http_code}' -X POST -H "Origin: https://$app" \
		-H 'Content-Type: application/x-www-form-urlencoded' --data 'email=&password=' \
		"https://$app/login?/signIn")"
check 'cross-site form post is refused' 403 \
	"$(request -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://evil.example' \
		-H 'Content-Type: application/x-www-form-urlencoded' --data 'email=&password=' \
		"https://$app/login?/signIn")"
check 'LiveKit answers through the proxy' OK \
	"$(request "https://$rtc/")"

# A LiveKit token from the SDK inside the image, to open the signaling WebSocket.
token="$("${compose[@]}" exec -T app node --input-type=module -e "
	import { AccessToken } from 'livekit-server-sdk';
	const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: 'proxy-test' });
	token.addGrant({ room: 'proxy-test', roomJoin: true });
	console.log(await token.toJwt());
")"
# curl stops after the timeout, as the socket stays open; the status line is what counts.
websocket_status="$(request --http1.1 -o /dev/null -w '%{http_code}' --max-time 5 \
	-H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
	-H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
	"https://$rtc/rtc?access_token=$token" || true)"
check 'LiveKit WebSocket upgrades through the proxy' 101 "$websocket_status"

if [ "$failures" -ne 0 ]; then
	echo "$failures check(s) failed"
	exit 1
fi
echo 'All reverse proxy checks passed'
