import { describe, expect, it } from 'vitest';
import data from 'emojibase-data/en/compact.json';
import {
	addRecent,
	EMOJI_GROUPS,
	frequentEmojis,
	MAX_RECENT_EMOJIS,
	searchEmojis,
	toCatalog
} from './emoji.ts';
import { parseEmoji, QUICK_REACTIONS } from './reactions.ts';

const catalog = toCatalog(data);

describe('toCatalog', () => {
	it('keeps the picker groups in order and drops skin tone swatches', () => {
		const groups = new Set(EMOJI_GROUPS.map((g) => g.id as number));
		expect(catalog.length).toBeGreaterThan(1500);
		expect(catalog.every((e) => groups.has(e.group))).toBe(true);
		expect(catalog.map((e) => e.emoji)).not.toContain('🏻');
		expect(catalog[0].group).toBe(0);
	});

	it('only has emojis that are accepted as reactions', () => {
		const rejected = catalog.filter((e) => parseEmoji(e.emoji) !== e.emoji);
		expect(rejected.map((e) => e.label)).toEqual([]);
	});

	it('knows every quick reaction', () => {
		const known = new Set(catalog.map((e) => e.emoji));
		expect(QUICK_REACTIONS.filter((e) => !known.has(e))).toEqual([]);
	});
});

describe('searchEmojis', () => {
	it('finds emojis by the start of their words, name matches first', () => {
		const hearts = searchEmojis(catalog, 'heart');
		expect(hearts.length).toBeGreaterThan(5);
		expect(hearts[0].label).toContain('heart');
		expect(searchEmojis(catalog, 'party pop').map((e) => e.emoji)).toContain('🎉');
		expect(searchEmojis(catalog, 'PIZZA')[0].emoji).toBe('🍕');
	});

	it('finds emojis by tag and returns nothing for an empty search', () => {
		expect(searchEmojis(catalog, 'lol').length).toBeGreaterThan(0);
		expect(searchEmojis(catalog, '   ')).toEqual([]);
		expect(searchEmojis(catalog, 'zzzqqq')).toEqual([]);
	});
});

describe('recent emojis', () => {
	it('moves the used emoji to the front without duplicates', () => {
		expect(addRecent(['👍', '🎉'], '🎉')).toEqual(['🎉', '👍']);
		const full = Array.from({ length: MAX_RECENT_EMOJIS }, (_, i) => String(i));
		expect(addRecent(full, '🍕')).toHaveLength(MAX_RECENT_EMOJIS);
	});

	it('fills the frequently used list with the quick reactions', () => {
		const list = frequentEmojis(['🍕', '👍']);
		expect(list.slice(0, 2)).toEqual(['🍕', '👍']);
		expect(list).toContain('🎉');
		expect(new Set(list).size).toBe(list.length);
	});
});
