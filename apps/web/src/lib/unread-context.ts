import { createContext } from 'svelte';
import type { UnreadCounts } from '#lib/unread.ts';

/** Unread counts of the signed-in user, kept live by the app layout for every tab. */
export const [getUnreadContext, setUnreadContext] = createContext<{
	readonly counts: UnreadCounts;
	/** Marks a chat as read right away, before the server's counts catch up. */
	clear(chatId: string): void;
}>();
