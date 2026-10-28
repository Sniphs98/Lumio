import { describe, expect, it, vi } from 'vitest';
import type { ChannelEvent } from '#lib/chat.ts';
import { publish, subscribe } from './realtime.ts';

const event = (channelId: string): ChannelEvent => ({
	type: 'message.created',
	message: {
		id: 'm1',
		channelId,
		content: 'hi',
		createdAt: '2026-01-01T10:00:00Z',
		editedAt: null,
		author: { id: 'u1', name: 'Lukas', image: null }
	}
});

describe('realtime hub', () => {
	it('delivers events only to subscribers of that channel', () => {
		const a = vi.fn();
		const b = vi.fn();
		const offA = subscribe('a', a);
		const offB = subscribe('b', b);

		publish('a', event('a'));

		expect(a).toHaveBeenCalledWith(event('a'));
		expect(b).not.toHaveBeenCalled();
		offA();
		offB();
	});

	it('stops delivering after unsubscribe', () => {
		const listener = vi.fn();
		const off = subscribe('c', listener);
		off();
		publish('c', event('c'));
		expect(listener).not.toHaveBeenCalled();
	});
});
