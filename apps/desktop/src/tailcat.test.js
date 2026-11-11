import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findTailcat, isTailcatAddress, parseForwardLine, startForward } from './tailcat.js';

test('parseForwardLine reads the local and remote port', () => {
	assert.deepEqual(parseForwardLine('# forwarding 127.0.0.1:53124 -> remote localhost:443'), {
		localPort: 53124,
		remotePort: 443
	});
	assert.deepEqual(parseForwardLine('# forwarding [::1]:3479 -> remote localhost:3479\r'), {
		localPort: 3479,
		remotePort: 3479
	});
	assert.equal(parseForwardLine('# 🐈 something else'), null);
});

test('isTailcatAddress accepts tailcat addresses and DNS names', () => {
	assert.ok(isTailcatAddress('tcomFwWCCcjS5nKNqAod034nWoJZW0LZqDhhC8U_dKdnDRYQ8uNGFpGQEu'));
	assert.ok(isTailcatAddress('chat.example.com'));
	assert.ok(!isTailcatAddress('https://chat.example.com'));
	assert.ok(!isTailcatAddress('tc x'));
	assert.ok(!isTailcatAddress('--verbose'));
});

test('findTailcat prefers LUMIO_TAILCAT, then the PATH', () => {
	assert.equal(findTailcat({ env: { LUMIO_TAILCAT: '/opt/tc' } }), '/opt/tc');
	assert.equal(findTailcat({ env: {}, resourcesPath: '/nowhere', platform: 'linux' }), 'tailcat');
	assert.equal(findTailcat({ env: {}, platform: 'win32' }), 'tailcat.exe');
});

/** A stand-in for the tailcat program that prints what `tailcat forward` prints. */
async function fakeTailcat(script) {
	const dir = await mkdtemp(path.join(tmpdir(), 'lumio-tailcat-'));
	const file = path.join(dir, 'tailcat');
	await writeFile(file, `#!/bin/sh\n${script}\n`);
	await chmod(file, 0o755);
	return file;
}

test(
	'startForward resolves with the local port for 443',
	{ skip: process.platform === 'win32' },
	async () => {
		const command = await fakeTailcat(
			[
				'[ "$1 $3 $4" = "forward 0:443 3479" ] || exit 2',
				'echo "# forwarding 127.0.0.1:40123 -> remote localhost:443" >&2',
				'echo "# forwarding 127.0.0.1:3479 -> remote localhost:3479" >&2',
				'exec sleep 30'
			].join('\n')
		);
		const forward = await startForward({
			address: 'tcXXXXXXXXXXXXXXXXXXXXXXXX',
			command
		});
		assert.equal(forward.httpsPort, 40123);
		forward.stop();
	}
);

test(
	'startForward fails with tailcat output when tailcat exits',
	{ skip: process.platform === 'win32' },
	async () => {
		const command = await fakeTailcat('echo "bad address" >&2; exit 1');
		await assert.rejects(
			startForward({ address: 'tcXXXXXXXXXXXXXXXXXXXXXXXX', command }),
			/exit code 1\)\.\nbad address/
		);
	}
);

test('startForward explains a missing tailcat', async () => {
	await assert.rejects(
		startForward({
			address: 'tcXXXXXXXXXXXXXXXXXXXXXXXX',
			command: '/does/not/exist/tailcat'
		}),
		/tailcat is not installed/
	);
});
