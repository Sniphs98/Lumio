import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Attachment } from '#lib/attachments.ts';
import type { ChatMessage, ChatUser, ReplyPreview } from '#lib/chat.ts';
import { parseMentionIds } from '#lib/mentions.ts';
import { groupReactions, MAX_REACTIONS_PER_MESSAGE, type Reaction } from '#lib/reactions.ts';
import { listAttachments } from '#lib/server/attachments.ts';
import { storage } from '#lib/server/uploads.ts';
import { db } from '#lib/server/db/index.ts';
import {
	attachment,
	conversationMember,
	message,
	messageMention,
	reaction,
	readState,
	user
} from '#lib/server/db/schema.ts';

/** Where a message lives: a server channel or a direct or group conversation. */
export type MessageTarget = { channelId: string } | { conversationId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = {
	id: message.id,
	channelId: message.channelId,
	conversationId: message.conversationId,
	content: message.content,
	createdAt: message.createdAt,
	editedAt: message.editedAt,
	replyToId: message.replyToId,
	authorId: user.id,
	authorName: user.name,
	authorImage: user.image
};

type Row = {
	id: string;
	channelId: string | null;
	conversationId: string | null;
	content: string;
	createdAt: Date;
	editedAt: Date | null;
	replyToId: string | null;
	authorId: string;
	authorName: string;
	authorImage: string | null;
};

type Extras = {
	attachments: Map<string, Attachment[]>;
	mentions: Map<string, ChatUser[]>;
	reactions: Map<string, Reaction[]>;
	replies: Map<string, ReplyPreview>;
};

function toChatMessage(row: Row, extras: Extras): ChatMessage {
	return {
		id: row.id,
		channelId: row.channelId,
		conversationId: row.conversationId,
		content: row.content,
		createdAt: row.createdAt.toISOString(),
		editedAt: row.editedAt?.toISOString() ?? null,
		author: { id: row.authorId, name: row.authorName, image: row.authorImage },
		attachments: extras.attachments.get(row.id) ?? [],
		replyTo: (row.replyToId && extras.replies.get(row.replyToId)) || null,
		mentions: extras.mentions.get(row.id) ?? [],
		reactions: extras.reactions.get(row.id) ?? []
	};
}

function whereTarget(target: MessageTarget) {
	return 'channelId' in target
		? eq(message.channelId, target.channelId)
		: eq(message.conversationId, target.conversationId);
}

function whereAttachmentTarget(target: MessageTarget) {
	return 'channelId' in target
		? eq(attachment.channelId, target.channelId)
		: eq(attachment.conversationId, target.conversationId);
}

/** The mentioned users of the given messages, keyed by message id. */
async function listMentions(messageIds: string[]): Promise<Map<string, ChatUser[]>> {
	const byMessage = new Map<string, ChatUser[]>();
	if (messageIds.length === 0) return byMessage;
	const rows = await db
		.select({ messageId: messageMention.messageId, id: user.id, name: user.name })
		.from(messageMention)
		.innerJoin(user, eq(user.id, messageMention.userId))
		.where(inArray(messageMention.messageId, messageIds));
	for (const { messageId, ...mentioned } of rows) {
		byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), mentioned]);
	}
	return byMessage;
}

/** The reactions of the given messages, keyed by message id. */
async function listReactions(messageIds: string[]): Promise<Map<string, Reaction[]>> {
	if (messageIds.length === 0) return new Map();
	const rows = await db
		.select({
			messageId: reaction.messageId,
			emoji: reaction.emoji,
			userId: user.id,
			userName: user.name
		})
		.from(reaction)
		.innerJoin(user, eq(user.id, reaction.userId))
		.where(inArray(reaction.messageId, messageIds))
		.orderBy(asc(reaction.createdAt), asc(reaction.userId));
	const byMessage = new Map<string, typeof rows>();
	for (const row of rows)
		byMessage.set(row.messageId, [...(byMessage.get(row.messageId) ?? []), row]);
	return new Map([...byMessage].map(([id, list]) => [id, groupReactions(list)]));
}

/** Previews of the messages that the given messages reply to, keyed by the replied message's id. */
async function listReplyPreviews(rows: Row[]): Promise<Map<string, ReplyPreview>> {
	const ids = [...new Set(rows.map((r) => r.replyToId).filter((id) => id !== null))];
	if (ids.length === 0) return new Map();
	const [replied, mentions] = await Promise.all([
		db
			.select({
				id: message.id,
				content: message.content,
				authorId: user.id,
				authorName: user.name
			})
			.from(message)
			.innerJoin(user, eq(user.id, message.authorId))
			.where(inArray(message.id, ids)),
		listMentions(ids)
	]);
	return new Map(
		replied.map((r) => [
			r.id,
			{
				id: r.id,
				author: { id: r.authorId, name: r.authorName },
				content: r.content,
				mentions: mentions.get(r.id) ?? []
			}
		])
	);
}

/** Loads everything shown with the messages: files, mentions, reactions and replied messages. */
async function withExtras(rows: Row[]): Promise<ChatMessage[]> {
	const ids = rows.map((r) => r.id);
	const [attachments, mentions, reactions, replies] = await Promise.all([
		listAttachments(ids),
		listMentions(ids),
		listReactions(ids),
		listReplyPreviews(rows)
	]);
	const extras = { attachments, mentions, reactions, replies };
	return rows.map((row) => toChatMessage(row, extras));
}

/** A message that cannot be sent as it is. The text is shown to the user. */
export class MessageRejectedError extends Error {}

/** For `createMessage(…).catch(rejection)`: turns a rejected message into its error text. */
export function rejection(err: unknown): { rejected: string } {
	if (err instanceof MessageRejectedError) return { rejected: err.message };
	throw err;
}

/** The latest messages of a channel or conversation, oldest first. */
export async function listMessages(target: MessageTarget, limit = 50): Promise<ChatMessage[]> {
	const rows = await db
		.select(columns)
		.from(message)
		.innerJoin(user, eq(message.authorId, user.id))
		.where(whereTarget(target))
		.orderBy(desc(message.createdAt))
		.limit(limit);
	return withExtras(rows.reverse());
}

/**
 * Who a new message mentions: users named with `<@userId>` who exist (and, in a conversation,
 * are members), plus the author of the message it replies to. Never the author.
 */
async function resolveMentions(
	target: MessageTarget,
	authorId: string,
	content: string,
	replyAuthorId: string | null
): Promise<string[]> {
	const ids = new Set(parseMentionIds(content));
	if (replyAuthorId) ids.add(replyAuthorId);
	ids.delete(authorId);
	if (ids.size === 0) return [];

	const rows =
		'channelId' in target
			? await db
					.select({ id: user.id })
					.from(user)
					.where(inArray(user.id, [...ids]))
			: await db
					.select({ id: conversationMember.userId })
					.from(conversationMember)
					.where(
						and(
							eq(conversationMember.conversationId, target.conversationId),
							inArray(conversationMember.userId, [...ids])
						)
					);
	return rows.map((r) => r.id);
}

/**
 * Stores a message. `attachmentIds` must be the author's own finished, unsent uploads for the same
 * chat, and `replyToId` a message of the same chat; otherwise nothing is stored and a
 * `MessageRejectedError` is thrown.
 */
export async function createMessage(
	target: MessageTarget,
	authorId: string,
	content: string,
	{
		attachmentIds = [],
		replyToId = null
	}: { attachmentIds?: string[]; replyToId?: string | null } = {}
): Promise<ChatMessage> {
	let replyAuthorId: string | null = null;
	if (replyToId !== null) {
		const [replied] = UUID.test(replyToId)
			? await db
					.select({ authorId: message.authorId })
					.from(message)
					.where(and(eq(message.id, replyToId), whereTarget(target)))
			: [];
		if (!replied) throw new MessageRejectedError('The message you replied to is gone.');
		replyAuthorId = replied.authorId;
	}
	const mentionIds = await resolveMentions(target, authorId, content, replyAuthorId);

	const id = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(message)
			.values({ ...target, authorId, content, replyToId })
			.returning({ id: message.id });

		if (attachmentIds.length > 0) {
			const claimed = await tx
				.update(attachment)
				.set({ messageId: inserted.id })
				.where(
					and(
						inArray(attachment.id, attachmentIds),
						eq(attachment.uploaderId, authorId),
						isNull(attachment.messageId),
						whereAttachmentTarget(target)
					)
				)
				.returning({ id: attachment.id });
			if (claimed.length !== attachmentIds.length) {
				throw new MessageRejectedError('A file is missing or still uploading.');
			}
		}
		if (mentionIds.length > 0) {
			await tx
				.insert(messageMention)
				.values(mentionIds.map((userId) => ({ messageId: inserted.id, userId })));
		}
		return inserted.id;
	});

	const rows = await db
		.select(columns)
		.from(message)
		.innerJoin(user, eq(message.authorId, user.id))
		.where(eq(message.id, id));
	const [created] = await withExtras(rows);
	return created;
}

/** A message of the chat, or null if the id is not one. */
async function findMessage(target: MessageTarget, messageId: unknown) {
	if (typeof messageId !== 'string' || !UUID.test(messageId)) return null;
	const [row] = await db
		.select({ id: message.id })
		.from(message)
		.where(and(eq(message.id, messageId), whereTarget(target)));
	return row ?? null;
}

/**
 * Adds the user's reaction to a message of the chat, or takes it back if it is there already.
 * Returns the message's reactions afterwards, or null if the message is not in this chat.
 */
export async function toggleReaction(
	target: MessageTarget,
	messageId: unknown,
	userId: string,
	emoji: string
): Promise<Reaction[] | null> {
	const found = await findMessage(target, messageId);
	if (!found) return null;

	const mine = and(
		eq(reaction.messageId, found.id),
		eq(reaction.userId, userId),
		eq(reaction.emoji, emoji)
	);
	const removed = await db.delete(reaction).where(mine).returning({ emoji: reaction.emoji });
	if (removed.length === 0) {
		const [{ used }] = await db
			.select({ used: count(sql`distinct ${reaction.emoji}`) })
			.from(reaction)
			.where(eq(reaction.messageId, found.id));
		const [{ exists }] = await db
			.select({ exists: count() })
			.from(reaction)
			.where(and(eq(reaction.messageId, found.id), eq(reaction.emoji, emoji)));
		if (used >= MAX_REACTIONS_PER_MESSAGE && exists === 0) {
			throw new MessageRejectedError('This message has as many different reactions as it can.');
		}
		await db.insert(reaction).values({ messageId: found.id, userId, emoji }).onConflictDoNothing();
	}
	return (await listReactions([found.id])).get(found.id) ?? [];
}

/**
 * Marks a chat as read up to a message of it. Never moves the read marker back.
 * Returns false if the message is not in this chat.
 */
export async function markRead(
	target: MessageTarget,
	userId: string,
	messageId: unknown
): Promise<boolean> {
	const found = await findMessage(target, messageId);
	if (!found) return false;
	// Taken from the row itself: JavaScript dates drop the microseconds Postgres keeps.
	const sentAt = sql`(select ${message.createdAt} from ${message} where ${message.id} = ${found.id})`;
	await db
		.insert(readState)
		.values({ userId, ...target, lastReadMessageId: found.id, lastReadAt: sentAt })
		.onConflictDoUpdate({
			target:
				'channelId' in target
					? [readState.userId, readState.channelId]
					: [readState.userId, readState.conversationId],
			set: { lastReadMessageId: found.id, lastReadAt: sentAt, updatedAt: new Date() },
			setWhere: sql`${readState.lastReadAt} is null or ${readState.lastReadAt} < ${sentAt}`
		});
	return true;
}

/** People who can be mentioned in a chat: every member of the instance, or of the conversation. */
export async function listMentionable(target: MessageTarget): Promise<ChatUser[]> {
	if ('channelId' in target) {
		return db.select({ id: user.id, name: user.name }).from(user).orderBy(asc(user.name));
	}
	return db
		.select({ id: user.id, name: user.name })
		.from(conversationMember)
		.innerJoin(user, eq(user.id, conversationMember.userId))
		.where(eq(conversationMember.conversationId, target.conversationId))
		.orderBy(asc(user.name));
}

/**
 * Deletes a message of the chat with its files, reactions and mentions. Authors may delete their
 * own messages; `canDeleteOthers` (Manage messages in a channel) allows deleting anyone's.
 * Replies to it keep an empty reply preview.
 */
export async function deleteMessage(
	target: MessageTarget,
	messageId: unknown,
	userId: string,
	canDeleteOthers: boolean
): Promise<'deleted' | 'not-found' | 'forbidden'> {
	if (typeof messageId !== 'string' || !UUID.test(messageId)) return 'not-found';
	const [row] = await db
		.select({ authorId: message.authorId })
		.from(message)
		.where(and(eq(message.id, messageId), whereTarget(target)));
	if (!row) return 'not-found';
	if (row.authorId !== userId && !canDeleteOthers) return 'forbidden';

	const files = await db
		.select({ id: attachment.id })
		.from(attachment)
		.where(eq(attachment.messageId, messageId));
	// Attachments, reactions and mentions go with the message (`on delete cascade`).
	await db.delete(message).where(eq(message.id, messageId));
	for (const file of files) await storage.remove(file.id).catch(() => {});
	return 'deleted';
}
