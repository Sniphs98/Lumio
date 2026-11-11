import http from 'node:http';
import net from 'node:net';

/**
 * A local HTTP proxy that sends every HTTPS connection of the app window into the tailcat
 * tunnel. Chromium asks it with `CONNECT host:443`; the host name is not resolved here, the
 * reverse proxy on the server picks the site by its TLS server name. So the server needs no
 * public DNS record or IP address.
 *
 * @param {{ tunnelPort: number }} options The local port of `tailcat forward` for port 443.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startTunnelProxy({ tunnelPort }) {
	const server = http.createServer((_request, response) => {
		// Plain HTTP is not tunneled: Lumio needs HTTPS for microphone and camera anyway.
		response.writeHead(405, { 'content-type': 'text/plain' });
		response.end('Only HTTPS goes through the tailcat tunnel.\n');
	});

	server.on('connect', (request, client, head) => {
		const port = connectPort(request.url);
		if (port !== 443) {
			client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
			return;
		}
		let connected = false;
		const upstream = net.connect(tunnelPort, '127.0.0.1', () => {
			connected = true;
			client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
			if (head.length > 0) upstream.write(head);
			upstream.pipe(client);
			client.pipe(upstream);
		});
		upstream.on('error', () => {
			if (connected) client.destroy();
			else client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
		});
		client.on('error', () => upstream.destroy());
	});

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = /** @type {net.AddressInfo} */ (server.address());
	return {
		port: address.port,
		close: () =>
			new Promise((resolve) => {
				server.close(() => resolve());
				server.closeAllConnections?.();
			})
	};
}

/** The port of a CONNECT target such as `chat.example.com:443` or `[::1]:443`. */
export function connectPort(target = '') {
	const match = /:(\d+)$/.exec(target);
	return match ? Number(match[1]) : NaN;
}
