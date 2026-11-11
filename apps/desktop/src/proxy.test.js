import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';
import { connectPort, startTunnelProxy } from './proxy.js';

test('connectPort reads the port of a CONNECT target', () => {
	assert.equal(connectPort('chat.example.com:443'), 443);
	assert.equal(connectPort('[::1]:8443'), 8443);
	assert.ok(Number.isNaN(connectPort('chat.example.com')));
});

/** Sends a CONNECT request and resolves with the response head and the open socket. */
function connect(proxyPort, target) {
	return new Promise((resolve, reject) => {
		const socket = net.connect(proxyPort, '127.0.0.1', () => {
			socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`);
		});
		let data = '';
		socket.setEncoding('utf8');
		socket.on('data', function onData(chunk) {
			data += chunk;
			const end = data.indexOf('\r\n\r\n');
			if (end === -1) return;
			socket.off('data', onData);
			resolve({ head: data.slice(0, end), rest: data.slice(end + 4), socket });
		});
		socket.on('error', reject);
	});
}

test('CONNECT to port 443 of any host reaches the tunnel port', async () => {
	// Stands in for `tailcat forward`: echoes what it gets.
	const tunnel = net.createServer((socket) => socket.pipe(socket));
	await new Promise((resolve) => tunnel.listen(0, '127.0.0.1', resolve));
	const proxy = await startTunnelProxy({ tunnelPort: tunnel.address().port });
	try {
		const { head, socket } = await connect(proxy.port, 'rtc.example.com:443');
		assert.match(head, /^HTTP\/1\.1 200/);
		const echo = new Promise((resolve) => socket.once('data', resolve));
		socket.write('hello');
		assert.equal(await echo, 'hello');
		socket.destroy();
	} finally {
		await proxy.close();
		tunnel.close();
	}
});

test('CONNECT to other ports is refused', async () => {
	const proxy = await startTunnelProxy({ tunnelPort: 9 });
	try {
		const { head, socket } = await connect(proxy.port, 'chat.example.com:22');
		assert.match(head, /^HTTP\/1\.1 403/);
		socket.destroy();
	} finally {
		await proxy.close();
	}
});

test('CONNECT answers 502 when the tunnel is not listening', async () => {
	const unused = net.createServer();
	await new Promise((resolve) => unused.listen(0, '127.0.0.1', resolve));
	const port = unused.address().port;
	await new Promise((resolve) => unused.close(resolve));
	const proxy = await startTunnelProxy({ tunnelPort: port });
	try {
		const { head, socket } = await connect(proxy.port, 'chat.example.com:443');
		assert.match(head, /^HTTP\/1\.1 502/);
		socket.destroy();
	} finally {
		await proxy.close();
	}
});
