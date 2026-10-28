import { describe, expect, it } from 'vitest';
import { publish } from './realtime.ts';
import { eventStream } from './sse.ts';

async function readAll(response: Response): Promise<string> {
	return new Response(response.body).text();
}

describe('eventStream', () => {
	it('forwards events and ends without forwarding the one `until` matches', async () => {
		const response = eventStream('sse-test', new Request('http://localhost/'), {
			until: (event) => event.type === 'member.removed' && event.userId === 'me'
		});
		const text = readAll(response);

		publish('sse-test', { type: 'member.removed', userId: 'someone-else' });
		publish('sse-test', { type: 'member.removed', userId: 'me' });
		publish('sse-test', { type: 'member.removed', userId: 'after-close' });

		const body = await text;
		expect(body).toContain('event: member.removed');
		expect(body).toContain('"userId":"someone-else"');
		expect(body).not.toContain('"userId":"me"');
		expect(body).not.toContain('after-close');
	});

	it('ends when the request is aborted', async () => {
		const abort = new AbortController();
		const response = eventStream(
			'sse-abort',
			new Request('http://localhost/', { signal: abort.signal })
		);
		const text = readAll(response);
		abort.abort();
		expect(await text).toBe('retry: 3000\n\n');
	});
});
