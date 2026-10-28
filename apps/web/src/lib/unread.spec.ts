import { describe, expect, it } from 'vitest';
import { clearUnread, describeUnread, formatCount, sumUnread } from './unread.ts';

describe('sumUnread', () => {
	it('adds up counts, leaving out the open chat', () => {
		const counts = { a: { count: 2, mentions: 1 }, b: { count: 5, mentions: 0 } };
		expect(sumUnread(counts)).toEqual({ count: 7, mentions: 1 });
		expect(sumUnread(counts, 'a')).toEqual({ count: 5, mentions: 0 });
		expect(sumUnread({})).toEqual({ count: 0, mentions: 0 });
	});
});

describe('clearUnread', () => {
	it('removes a read chat and keeps the rest', () => {
		const counts = {
			channels: { c1: { count: 1, mentions: 0 } },
			conversations: { d1: { count: 3, mentions: 3 } }
		};
		expect(clearUnread(counts, 'd1')).toEqual({ channels: counts.channels, conversations: {} });
		expect(clearUnread(counts, 'other')).toBe(counts);
	});
});

describe('formatCount and describeUnread', () => {
	it('caps the counter and describes it for screen readers', () => {
		expect(formatCount(7)).toBe('7');
		expect(formatCount(100)).toBe('99+');
		expect(describeUnread({ count: 1, mentions: 0 })).toBe('1 unread message');
		expect(describeUnread({ count: 4, mentions: 1 })).toBe('4 unread messages, 1 mention');
	});
});
