import { describe, expect, it } from 'vitest';
import { hasChat, isJoinable } from './channels.ts';

describe('channel types', () => {
	it('gives text and voice channels a chat, but not categories', () => {
		expect(hasChat('text')).toBe(true);
		expect(hasChat('voice')).toBe(true);
		expect(hasChat('category')).toBe(false);
	});

	it('only lets people join voice channels', () => {
		expect(isJoinable('voice')).toBe(true);
		expect(isJoinable('text')).toBe(false);
		expect(isJoinable('category')).toBe(false);
	});
});
