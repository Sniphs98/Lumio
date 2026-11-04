/** The emoji catalog of the emoji picker, shared by the composer and reactions. */
import { QUICK_REACTIONS } from '#lib/reactions.ts';

export type Emoji = {
	emoji: string;
	/** English name, e.g. `grinning face`. */
	label: string;
	/** Lower-case words to search for: the name and its tags. */
	keywords: string[];
	group: EmojiGroupId;
};

/** Emoji groups in picker order, with the emoji shown on their button. Emojibase group ids. */
export const EMOJI_GROUPS = [
	{ id: 0, name: 'Smileys & emotion', icon: '😀' },
	{ id: 1, name: 'People & body', icon: '👋' },
	{ id: 3, name: 'Animals & nature', icon: '🐻' },
	{ id: 4, name: 'Food & drink', icon: '🍔' },
	{ id: 5, name: 'Travel & places', icon: '🚗' },
	{ id: 6, name: 'Activities', icon: '⚽' },
	{ id: 7, name: 'Objects', icon: '💡' },
	{ id: 8, name: 'Symbols', icon: '❤️' },
	{ id: 9, name: 'Flags', icon: '🏁' }
] as const;

export type EmojiGroupId = (typeof EMOJI_GROUPS)[number]['id'];

/** Emojis kept in the "Frequently used" list. */
export const MAX_RECENT_EMOJIS = 24;

/** Emojis shown at most for a search. */
export const MAX_SEARCH_RESULTS = 120;

const RECENT_KEY = 'lumio:recent-emojis';

type EmojibaseEntry = {
	unicode: string;
	label: string;
	group?: number;
	order?: number;
	tags?: string[];
};

/** Turns Emojibase's compact data into the catalog, dropping skin tone swatches and regional letters. */
export function toCatalog(entries: EmojibaseEntry[]): Emoji[] {
	const groups = new Set<number>(EMOJI_GROUPS.map((g) => g.id));
	return entries
		.filter((e) => e.group !== undefined && groups.has(e.group))
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((e) => ({
			emoji: e.unicode,
			label: e.label,
			keywords: [e.label.toLowerCase(), ...(e.tags ?? []).map((t) => t.toLowerCase())],
			group: e.group as EmojiGroupId
		}));
}

let catalog: Promise<Emoji[]> | undefined;

/** Loads the catalog once. It is a separate chunk, fetched when a picker first opens. */
export function loadEmojis(): Promise<Emoji[]> {
	catalog ??= import('emojibase-data/en/compact.json')
		.then((data) => toCatalog(data.default as EmojibaseEntry[]))
		.catch((error) => {
			catalog = undefined;
			throw error;
		});
	return catalog;
}

/**
 * Emojis matching a search: every word must start a word of the name or a tag. Matches of the
 * name come first, e.g. `heart` finds `red heart` before emojis merely tagged with it.
 */
export function searchEmojis(emojis: Emoji[], query: string): Emoji[] {
	const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const startsWord = (text: string, word: string) =>
		text.startsWith(word) || text.includes(` ${word}`);

	const byName: Emoji[] = [];
	const byTag: Emoji[] = [];
	for (const emoji of emojis) {
		if (words.every((w) => startsWord(emoji.keywords[0], w))) byName.push(emoji);
		else if (words.every((w) => emoji.keywords.some((k) => startsWord(k, w)))) byTag.push(emoji);
	}
	return [...byName, ...byTag].slice(0, MAX_SEARCH_RESULTS);
}

/** Moves an emoji to the front of the recently used list. */
export function addRecent(recent: string[], emoji: string): string[] {
	return [emoji, ...recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT_EMOJIS);
}

/** The "Frequently used" list: recently used emojis, filled up with the quick reactions. */
export function frequentEmojis(recent: string[]): string[] {
	const list = [...recent];
	for (const emoji of QUICK_REACTIONS) {
		if (list.length >= MAX_RECENT_EMOJIS) break;
		if (!list.includes(emoji)) list.push(emoji);
	}
	return list;
}

/** Recently used emojis of this browser. Storage may be unavailable, e.g. in private windows. */
export function readRecent(): string[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((e) => typeof e === 'string') : [];
	} catch {
		return [];
	}
}

export function saveRecent(recent: string[]) {
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
	} catch {
		// Not remembering recent emojis is fine.
	}
}
