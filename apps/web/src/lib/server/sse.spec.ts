import { describe, expect, it, vi } from 'vitest';
import type { RealtimeEvent } from '#lib/chat.ts';
import { publish } from './realtime.ts';
import { eventStream } from './sse.ts';

const changed = (channelId: string): RealtimeEvent => ({
	type: 'voice.changed',
	channelId,
	members: []
});

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, text: string) {
	const decoder = new TextDecoder();
	let received = '';
	while (!received.includes(text)) {
		const { value, done } = await reader.read();
		if (done) break;
		received += decoder.decode(value);
	}
	return received;
}

describe('eventStream', () => {
	it('sends the initial events first, queues events meanwhile and filters them', async () => {
		const abort = new AbortController();
		const onClose = vi.fn();
		let resolveInitial!: (events: RealtimeEvent[]) => void;
		const res = eventStream('sse-test', new Request('http://x', { signal: abort.signal }), {
			initial: () => new Promise((resolve) => (resolveInitial = resolve)),
			filter: (event) => event.type !== 'voice.changed' || event.channelId !== 'hidden',
			onClose
		});
		const reader = res.body!.getReader();

		publish('sse-test', changed('hidden'));
		publish('sse-test', changed('queued'));
		resolveInitial([{ type: 'voice.state', channels: {} }]);
		await Promise.resolve();
		publish('sse-test', changed('later'));

		const received = await readUntil(reader, 'later');
		expect(received).not.toContain('hidden');
		const order = ['voice.state', 'queued', 'later'].map((s) => received.indexOf(s));
		expect(order).toEqual([...order].sort((a, b) => a - b));
		expect(order[0]).toBeGreaterThan(-1);

		abort.abort();
		abort.abort();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('ends without forwarding the event `until` matches', async () => {
		const res = eventStream('sse-until', new Request('http://x'), {
			until: (event) => event.type === 'member.removed' && event.userId === 'me'
		});
		const text = new Response(res.body).text();

		publish('sse-until', { type: 'member.removed', userId: 'someone-else' });
		publish('sse-until', { type: 'member.removed', userId: 'me' });
		publish('sse-until', { type: 'member.removed', userId: 'after-close' });

		const body = await text;
		expect(body).toContain('"userId":"someone-else"');
		expect(body).not.toContain('"userId":"me"');
		expect(body).not.toContain('after-close');
	});
});
