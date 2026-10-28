/** Shared unread counter types and rules, used on the server and in the browser. */

/** Unread messages from others in one chat, and how many of them mention the user. */
export type UnreadCount = { count: number; mentions: number };

/** Unread counts by channel id and by conversation id. Chats without unread messages are left out. */
export type UnreadCounts = {
	channels: Record<string, UnreadCount>;
	conversations: Record<string, UnreadCount>;
};

export const NO_UNREAD: UnreadCount = { count: 0, mentions: 0 };

/** Adds up the unread counts of several chats, leaving out the open one. */
export function sumUnread(counts: Record<string, UnreadCount>, exceptId?: string): UnreadCount {
	let count = 0;
	let mentions = 0;
	for (const [id, c] of Object.entries(counts)) {
		if (id === exceptId) continue;
		count += c.count;
		mentions += c.mentions;
	}
	return { count, mentions };
}

/** The counts after the user read a chat. */
export function clearUnread(counts: UnreadCounts, chatId: string): UnreadCounts {
	if (!(chatId in counts.channels) && !(chatId in counts.conversations)) return counts;
	const channels = { ...counts.channels };
	const conversations = { ...counts.conversations };
	delete channels[chatId];
	delete conversations[chatId];
	return { channels, conversations };
}

/** Short counter text, e.g. `7` or `99+`. */
export function formatCount(n: number): string {
	return n > 99 ? '99+' : String(n);
}

/** Label for screen readers, e.g. `3 unread messages, 1 mention`. */
export function describeUnread({ count, mentions }: UnreadCount): string {
	const text = `${count} unread ${count === 1 ? 'message' : 'messages'}`;
	return mentions > 0 ? `${text}, ${mentions} ${mentions === 1 ? 'mention' : 'mentions'}` : text;
}
