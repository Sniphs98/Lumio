import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** The TURN port the server's LiveKit announces as 127.0.0.1, see docker-compose.tailcat.yml. */
export const DEFAULT_TURN_PORT = 3479;

/** Tailcat addresses start with "tc" followed by base64url. A DNS name with a TXT record works too. */
export function isTailcatAddress(value) {
	return /^tc[A-Za-z0-9_-]{20,}$/.test(value) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value);
}

/**
 * The tailcat program: LUMIO_TAILCAT, one bundled next to the app, or `tailcat` on the PATH.
 *
 * @param {{ env?: NodeJS.ProcessEnv, resourcesPath?: string, platform?: string }} [options]
 */
export function findTailcat({
	env = process.env,
	resourcesPath = process.resourcesPath,
	platform = process.platform
} = {}) {
	if (env.LUMIO_TAILCAT) return env.LUMIO_TAILCAT;
	const name = platform === 'win32' ? 'tailcat.exe' : 'tailcat';
	if (resourcesPath) {
		const bundled = path.join(resourcesPath, 'tailcat', name);
		if (existsSync(bundled)) return bundled;
	}
	return name;
}

/**
 * Reads a `tailcat forward` status line, e.g.
 * `# forwarding 127.0.0.1:53124 -> remote localhost:443`.
 *
 * @returns {{ localPort: number, remotePort: number } | null}
 */
export function parseForwardLine(line) {
	const match = /^# forwarding \S*:(\d+) -> remote \S*:(\d+)\s*$/.exec(line.trim());
	return match ? { localPort: Number(match[1]), remotePort: Number(match[2]) } : null;
}

/**
 * Starts `tailcat forward` to the server: port 443 on a free local port, and the TURN port on
 * the same local port, because LiveKit announces the TURN server as 127.0.0.1 with that port.
 * Resolves once both listeners are up. The tunnel itself connects on the first connection.
 *
 * @param {{ address: string, turnPort?: number, command?: string, timeoutMs?: number }} options
 * @returns {Promise<{ httpsPort: number, stop: () => void, child: import('node:child_process').ChildProcess }>}
 */
export function startForward({
	address,
	turnPort = DEFAULT_TURN_PORT,
	command = findTailcat(),
	timeoutMs = 15_000
}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, ['forward', address, '0:443', String(turnPort)], {
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true
		});
		const ports = new Map();
		let output = '';
		let settled = false;

		const fail = (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			child.kill();
			reject(error);
		};
		const timer = setTimeout(
			() => fail(new Error(`tailcat did not start in time.${lastLines(output)}`)),
			timeoutMs
		);

		child.on('error', (error) => {
			fail(
				error.code === 'ENOENT'
					? new Error(
							'tailcat is not installed. Install it from https://github.com/tailscale/tailcat and try again.'
						)
					: error
			);
		});
		child.on('exit', (code) => {
			fail(new Error(`tailcat stopped (exit code ${code}).${lastLines(output)}`));
		});
		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk) => {
			output += chunk;
			for (const line of chunk.split('\n')) {
				const forward = parseForwardLine(line);
				if (forward) ports.set(forward.remotePort, forward.localPort);
			}
			if (!settled && ports.has(443) && ports.has(turnPort)) {
				settled = true;
				clearTimeout(timer);
				resolve({ httpsPort: ports.get(443), child, stop: () => child.kill() });
			}
		});
	});
}

function lastLines(output) {
	const lines = output.trim().split('\n').slice(-3).join('\n');
	return lines ? `\n${lines}` : '';
}
