import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { DEFAULT_MAX_UPLOAD_SIZE, type Attachment, type UploadTarget } from '#lib/attachments.ts';
import { hasChat } from '#lib/channels.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import { canSendInConversation, getConversation } from '#lib/server/conversations.ts';
import { db } from '#lib/server/db/index.ts';
import { attachment, instance } from '#lib/server/db/schema.ts';

type AttachmentRow = typeof attachment.$inferSelect;

export function toAttachment(row: Pick<AttachmentRow, 'id' | 'fileName' | 'mimeType' | 'size'>) {
	return {
		id: row.id,
		fileName: row.fileName,
		mimeType: row.mimeType,
		size: row.size
	} satisfies Attachment;
}

export async function getMaxUploadSize(): Promise<number> {
	const [row] = await db.select({ maxUploadSize: instance.maxUploadSize }).from(instance);
	return row?.maxUploadSize ?? DEFAULT_MAX_UPLOAD_SIZE;
}

export async function setMaxUploadSize(bytes: number): Promise<void> {
	await db.update(instance).set({ maxUploadSize: bytes }).where(eq(instance.id, 1));
}

/** Whether a user may share files in a chat: they must be able to write there and attach files. */
export async function canUploadTo(userId: string, target: UploadTarget): Promise<boolean> {
	if ('channelId' in target) {
		const channel = await getChannel(target.channelId).catch(() => null);
		if (!channel || !hasChat(channel.type)) return false;
		const permissions = await getChannelPermissions(userId, channel.id);
		return (
			hasPermission(permissions, Permission.ViewChannel) &&
			hasPermission(permissions, Permission.SendMessages) &&
			hasPermission(permissions, Permission.AttachFiles)
		);
	}
	const conversation = await getConversation(target.conversationId, userId);
	return conversation !== null && (await canSendInConversation(conversation, userId));
}

/** Records a finished upload. It stays unsent until a message claims it. */
export async function createAttachment(input: {
	id: string;
	uploaderId: string;
	target: UploadTarget;
	fileName: string;
	mimeType: string;
	size: number;
}): Promise<void> {
	await db
		.insert(attachment)
		.values({
			id: input.id,
			uploaderId: input.uploaderId,
			...input.target,
			fileName: input.fileName,
			mimeType: input.mimeType,
			size: input.size
		})
		.onConflictDoNothing();
}

/** The attachments of the given messages, keyed by message id. */
export async function listAttachments(messageIds: string[]): Promise<Map<string, Attachment[]>> {
	const byMessage = new Map<string, Attachment[]>();
	if (messageIds.length === 0) return byMessage;
	const rows = await db
		.select()
		.from(attachment)
		.where(inArray(attachment.messageId, messageIds))
		.orderBy(attachment.createdAt);
	for (const row of rows) {
		const list = byMessage.get(row.messageId!) ?? [];
		list.push(toAttachment(row));
		byMessage.set(row.messageId!, list);
	}
	return byMessage;
}

/**
 * An attachment the user may download: one sent in a chat they can read, or their own unsent upload.
 * Returns null otherwise, so callers answer 404 and do not reveal that the file exists.
 */
export async function getReadableAttachment(
	id: string,
	userId: string
): Promise<AttachmentRow | null> {
	const [row] = await db.select().from(attachment).where(eq(attachment.id, id));
	if (!row) return null;
	if (row.messageId === null) return row.uploaderId === userId ? row : null;

	if (row.channelId) {
		const permissions = await getChannelPermissions(userId, row.channelId);
		return hasPermission(permissions, Permission.ViewChannel) ? row : null;
	}
	if (row.conversationId) {
		return (await getConversation(row.conversationId, userId)) ? row : null;
	}
	return null;
}

/** Removes uploads that were never sent and are older than `olderThan`. Returns their ids. */
export async function deleteUnsentAttachments(olderThan: Date): Promise<string[]> {
	const rows = await db
		.delete(attachment)
		.where(and(isNull(attachment.messageId), lt(attachment.createdAt, olderThan)))
		.returning({ id: attachment.id });
	return rows.map((r) => r.id);
}
