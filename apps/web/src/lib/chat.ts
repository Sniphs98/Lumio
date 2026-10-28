/** Shared chat types and rules, used on the server and in the browser. */

export const MAX_MESSAGE_LENGTH = 4000;

export type ChatMessage = {
	id: string;
	channelId: string;
	content: string;
	createdAt: string;
	editedAt: string | null;
	author: { id: string; name: string; image: string | null };
};

/** Events sent to clients over a channel's event stream. */
export type ChannelEvent = { type: 'message.created'; message: ChatMessage };

/**
 * Trims a message and checks its length.
 * Returns the cleaned content, or an error text for the user.
 */
export function normalizeContent(
	raw: unknown
): { ok: true; content: string } | { ok: false; error: string } {
	if (typeof raw !== 'string') return { ok: false, error: 'Message is missing.' };
	const content = raw.replace(/\r\n/g, '\n').trim();
	if (content.length === 0) return { ok: false, error: 'Message is empty.' };
	if (content.length > MAX_MESSAGE_LENGTH) {
		return { ok: false, error: `Message is longer than ${MAX_MESSAGE_LENGTH} characters.` };
	}
	return { ok: true, content };
}

/** Adds a message to a list sorted by time, ignoring duplicates (e.g. our own message echoed back). */
export function addMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
	if (list.some((m) => m.id === message.id)) return list;
	const next = [...list, message];
	next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return next;
}
