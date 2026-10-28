/**
 * Mentions are stored in message content as `<@userId>`, so they keep working when someone
 * changes their name. The composer shows `@Name` and encodes picked mentions before sending.
 */
import type { ChatUser } from '#lib/chat.ts';

const TOKEN = /<@([A-Za-z0-9_-]{1,64})>/g;

/** Mentions shown in the composer's suggestion list. */
export const MAX_MENTION_SUGGESTIONS = 8;

export function mentionToken(userId: string): string {
	return `<@${userId}>`;
}

/** Ids of the users a message's content mentions, without duplicates. */
export function parseMentionIds(content: string): string[] {
	return [...new Set(Array.from(content.matchAll(TOKEN), (m) => m[1]))];
}

export type ContentPart = { type: 'text'; text: string } | { type: 'mention'; userId: string };

/** Splits message content into text and mentions, for rendering. */
export function splitContent(content: string): ContentPart[] {
	const parts: ContentPart[] = [];
	let last = 0;
	for (const match of content.matchAll(TOKEN)) {
		if (match.index > last) parts.push({ type: 'text', text: content.slice(last, match.index) });
		parts.push({ type: 'mention', userId: match[1] });
		last = match.index + match[0].length;
	}
	if (last < content.length) parts.push({ type: 'text', text: content.slice(last) });
	return parts;
}

/** Content as plain text, with mentions written as `@Name`, e.g. for reply previews. */
export function contentToText(content: string, users: ChatUser[]): string {
	return splitContent(content)
		.map((part) =>
			part.type === 'text'
				? part.text
				: `@${users.find((u) => u.id === part.userId)?.name ?? 'unknown'}`
		)
		.join('');
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Turns `@Name` into `<@userId>` for every user picked from the suggestions. Longer names are
 * replaced first, so `@Anna Berg` wins over `@Anna`. A name only counts when it is not followed
 * by a letter or digit.
 */
export function encodeMentions(content: string, picked: ChatUser[]): string {
	const users = [...new Map(picked.map((u) => [u.name, u])).values()].sort(
		(a, b) => b.name.length - a.name.length
	);
	if (users.length === 0) return content;
	const pattern = new RegExp(
		`@(${users.map((u) => escapeRegExp(u.name)).join('|')})(?![\\p{L}\\p{N}])`,
		'gu'
	);
	return content.replace(pattern, (_, name: string) =>
		mentionToken(users.find((u) => u.name === name)!.id)
	);
}

/**
 * The `@query` being typed right before the caret, if any: an `@` at the start or after
 * whitespace, followed by anything but whitespace and `@`.
 */
export function activeMention(textBeforeCaret: string): { start: number; query: string } | null {
	const match = /(^|\s)@([^\s@]*)$/.exec(textBeforeCaret);
	if (!match) return null;
	return { start: match.index + match[1].length, query: match[2] };
}

/** Users whose name starts with the query (or has a word that does), best matches first. */
export function suggestMentions<T extends ChatUser>(users: T[], query: string, excludeId?: string) {
	const q = query.toLocaleLowerCase();
	const scored = users
		.filter((u) => u.id !== excludeId)
		.map((u) => {
			const name = u.name.toLocaleLowerCase();
			const score = name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 2;
			return { u, score };
		})
		.filter((s) => s.score < 2);
	scored.sort((a, b) => a.score - b.score || a.u.name.localeCompare(b.u.name));
	return scored.slice(0, MAX_MENTION_SUGGESTIONS).map((s) => s.u);
}
