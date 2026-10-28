import { describe, expect, it } from 'vitest';
import { addMessage, MAX_MESSAGE_LENGTH, normalizeContent, type ChatMessage } from './chat.ts';

const message = (id: string, createdAt: string): ChatMessage => ({
	id,
	channelId: 'c1',
	conversationId: null,
	content: id,
	createdAt,
	editedAt: null,
	author: { id: 'u1', name: 'Lukas', image: null },
	attachments: [],
	replyTo: null,
	mentions: [],
	reactions: []
});

describe('normalizeContent', () => {
	it('trims whitespace and normalizes line breaks', () => {
		expect(normalizeContent('  hi\r\nthere  ')).toEqual({ ok: true, content: 'hi\nthere' });
	});

	it('rejects empty and missing messages', () => {
		expect(normalizeContent('   ').ok).toBe(false);
		expect(normalizeContent(undefined).ok).toBe(false);
	});

	it('allows an empty text when the message has files', () => {
		expect(normalizeContent('  ', { allowEmpty: true })).toEqual({ ok: true, content: '' });
		expect(normalizeContent(null, { allowEmpty: true })).toEqual({ ok: true, content: '' });
	});

	it('rejects messages over the length limit', () => {
		expect(normalizeContent('a'.repeat(MAX_MESSAGE_LENGTH)).ok).toBe(true);
		expect(normalizeContent('a'.repeat(MAX_MESSAGE_LENGTH + 1)).ok).toBe(false);
	});
});

describe('addMessage', () => {
	it('keeps messages sorted by time', () => {
		const list = [message('a', '2026-01-01T10:00:00Z'), message('c', '2026-01-01T12:00:00Z')];
		const next = addMessage(list, message('b', '2026-01-01T11:00:00Z'));
		expect(next.map((m) => m.id)).toEqual(['a', 'b', 'c']);
	});

	it('ignores a message that is already in the list', () => {
		const list = [message('a', '2026-01-01T10:00:00Z')];
		expect(addMessage(list, message('a', '2026-01-01T10:00:00Z'))).toBe(list);
	});
});
