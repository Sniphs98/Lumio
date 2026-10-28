/** Shared chat types and rules, used on the server and in the browser. */
import type { Attachment } from '#lib/attachments.ts';
import type { CallRingingEvent, VoiceEvent } from '#lib/calls.ts';
import type { Reaction } from '#lib/reactions.ts';

export const MAX_MESSAGE_LENGTH = 4000;

/** Someone a message names, e.g. a mentioned user or a message's author. */
export type ChatUser = { id: string; name: string };

/** The message a reply answers, shown above the reply. */
export type ReplyPreview = {
	id: string;
	author: ChatUser;
	content: string;
	/** Users mentioned in `content`, to show their names. */
	mentions: ChatUser[];
};

export type ChatMessage = {
	id: string;
	/** Set for messages in a server channel. */
	channelId: string | null;
	/** Set for messages in a direct or group conversation. */
	conversationId: string | null;
	content: string;
	createdAt: string;
	editedAt: string | null;
	author: { id: string; name: string; image: string | null };
	attachments: Attachment[];
	/** The message this one answers, or null. */
	replyTo: ReplyPreview | null;
	/** Users mentioned with `<@userId>` in `content`, plus the author of the message replied to. */
	mentions: ChatUser[];
	reactions: Reaction[];
};

/** Events sent to clients over a channel's or conversation's event stream. */
export type ChannelEvent =
	| { type: 'message.created'; message: ChatMessage }
	| { type: 'reaction.changed'; messageId: string; reactions: Reaction[] }
	/** Someone was removed from or left a group; their stream of it closes. */
	| { type: 'member.removed'; userId: string };

/**
 * Someone wrote in a channel or conversation; clients reload their unread counts and may
 * play the message sound. Carries no content, so it can go to everyone. Sent to each member
 * for conversations and on `CHANNEL_ACTIVITY_TOPIC` for channels.
 */
export type ActivityEvent = { type: 'message.activity'; authorId: string; mentionIds: string[] } & (
	{ channelId: string; conversationId: null } | { channelId: null; conversationId: string }
);

/**
 * Events sent to a single user, e.g. when their friend list changes or someone calls them.
 * `conversation.removed` tells a user they are no longer in a group.
 */
export type UserEvent =
	| { type: 'home.changed' }
	| { type: 'conversation.removed'; conversationId: string }
	| CallRingingEvent
	| ActivityEvent;

export type RealtimeEvent = ChannelEvent | UserEvent | VoiceEvent;

/**
 * Trims a message and checks its length. A message with files may have no text (`allowEmpty`).
 * Returns the cleaned content, or an error text for the user.
 */
export function normalizeContent(
	raw: unknown,
	{ allowEmpty = false } = {}
): { ok: true; content: string } | { ok: false; error: string } {
	if (raw === null && allowEmpty) return { ok: true, content: '' };
	if (typeof raw !== 'string') return { ok: false, error: 'Message is missing.' };
	const content = raw.replace(/\r\n/g, '\n').trim();
	if (content.length === 0 && !allowEmpty) return { ok: false, error: 'Message is empty.' };
	if (content.length > MAX_MESSAGE_LENGTH) {
		return { ok: false, error: `Message is longer than ${MAX_MESSAGE_LENGTH} characters.` };
	}
	return { ok: true, content };
}

/** The `replyTo` field of the send form: a message id, or null when the message is no reply. */
export function parseReplyTo(raw: unknown): string | null {
	return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/** Replaces a message's reactions, e.g. after a `reaction.changed` event. */
export function setReactions(
	list: ChatMessage[],
	messageId: string,
	reactions: Reaction[]
): ChatMessage[] {
	return list.map((m) => (m.id === messageId ? { ...m, reactions } : m));
}

/** Adds a message to a list sorted by time, ignoring duplicates (e.g. our own message echoed back). */
export function addMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
	if (list.some((m) => m.id === message.id)) return list;
	const next = [...list, message];
	next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return next;
}
