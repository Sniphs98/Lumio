import { describe, expect, it } from 'vitest';
import { describeReaction, groupReactions, parseEmoji, QUICK_REACTIONS } from './reactions.ts';

describe('parseEmoji', () => {
	it('accepts emojis, including skin tones, joined emojis and flags', () => {
		for (const emoji of [...QUICK_REACTIONS, '👍🏽', '👩‍💻', '🇩🇪', '1️⃣']) {
			expect(parseEmoji(emoji)).toBe(emoji);
		}
	});

	it('rejects text, digits and overlong input', () => {
		for (const raw of ['', 'abc', '1', '#', '<script>', '👍a', '👍'.repeat(17), null, 5]) {
			expect(parseEmoji(raw)).toBeNull();
		}
	});
});

describe('groupReactions', () => {
	it('groups by emoji in the order they were first used', () => {
		expect(
			groupReactions([
				{ emoji: '🎉', userId: 'a', userName: 'Anna' },
				{ emoji: '👍', userId: 'b', userName: 'Ben' },
				{ emoji: '🎉', userId: 'b', userName: 'Ben' }
			])
		).toEqual([
			{
				emoji: '🎉',
				users: [
					{ id: 'a', name: 'Anna' },
					{ id: 'b', name: 'Ben' }
				]
			},
			{ emoji: '👍', users: [{ id: 'b', name: 'Ben' }] }
		]);
	});
});

describe('describeReaction', () => {
	const users = ['Anna', 'Ben', 'Cleo', 'Dave', 'Eve'].map((name) => ({ id: name, name }));

	it('names who reacted', () => {
		expect(describeReaction({ emoji: '👍', users: users.slice(0, 1) })).toBe(
			'Anna reacted with 👍'
		);
		expect(describeReaction({ emoji: '👍', users: users.slice(0, 2) }, 'Ben')).toBe(
			'Anna and You reacted with 👍'
		);
		expect(describeReaction({ emoji: '👍', users: users.slice(0, 4) })).toBe(
			'Anna, Ben, Cleo and 1 other reacted with 👍'
		);
		expect(describeReaction({ emoji: '👍', users })).toBe(
			'Anna, Ben, Cleo and 2 others reacted with 👍'
		);
	});
});
