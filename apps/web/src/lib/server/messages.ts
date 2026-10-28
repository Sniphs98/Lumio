import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Attachment } from '#lib/attachments.ts';
import type { ChatMessage } from '#lib/chat.ts';
import { listAttachments } from '#lib/server/attachments.ts';
import { db } from '#lib/server/db/index.ts';
import { attachment, message, user } from '#lib/server/db/schema.ts';

/** Where a message lives: a server channel or a direct or group conversation. */
export type MessageTarget = { channelId: string } | { conversationId: string };

const columns = {
	id: message.id,
	channelId: message.channelId,
	conversationId: message.conversationId,
	content: message.content,
	createdAt: message.createdAt,
	editedAt: message.editedAt,
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
	authorId: string;
	authorName: string;
	authorImage: string | null;
};

function toChatMessage(row: Row, attachments: Attachment[] = []): ChatMessage {
	return {
		id: row.id,
		channelId: row.channelId,
		conversationId: row.conversationId,
		content: row.content,
		createdAt: row.createdAt.toISOString(),
		editedAt: row.editedAt?.toISOString() ?? null,
		author: { id: row.authorId, name: row.authorName, image: row.authorImage },
		attachments
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

/** Thrown when a message refers to files that are not the author's unsent uploads for this chat. */
export class AttachmentClaimError extends Error {}

/** The latest messages of a channel or conversation, oldest first. */
export async function listMessages(target: MessageTarget, limit = 50): Promise<ChatMessage[]> {
	const rows = await db
		.select(columns)
		.from(message)
		.innerJoin(user, eq(message.authorId, user.id))
		.where(whereTarget(target))
		.orderBy(desc(message.createdAt))
		.limit(limit);
	const attachments = await listAttachments(rows.map((r) => r.id));
	return rows.reverse().map((row) => toChatMessage(row, attachments.get(row.id)));
}

/**
 * Stores a message. `attachmentIds` must be the author's own finished, unsent uploads for the same
 * chat; otherwise nothing is stored and an `AttachmentClaimError` is thrown.
 */
export async function createMessage(
	target: MessageTarget,
	authorId: string,
	content: string,
	attachmentIds: string[] = []
): Promise<ChatMessage> {
	const id = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(message)
			.values({ ...target, authorId, content })
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
				throw new AttachmentClaimError('A file is missing or still uploading.');
			}
		}
		return inserted.id;
	});

	const [row] = await db
		.select(columns)
		.from(message)
		.innerJoin(user, eq(message.authorId, user.id))
		.where(eq(message.id, id));
	const attachments = await listAttachments([id]);
	return toChatMessage(row, attachments.get(id));
}

/** For `createMessage(…).catch(attachmentError)`: turns a failed file claim into `null`. */
export function attachmentError(err: unknown): null {
	if (err instanceof AttachmentClaimError) return null;
	throw err;
}
