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
});
