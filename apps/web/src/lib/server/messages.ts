import { desc, eq } from 'drizzle-orm';
import type { ChatMessage } from '#lib/chat.ts';
import { db } from '#lib/server/db/index.ts';
import { message, user } from '#lib/server/db/schema.ts';

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

function toChatMessage(row: Row): ChatMessage {
	return {
		id: row.id,
		channelId: row.channelId,
		conversationId: row.conversationId,
		content: row.content,
		createdAt: row.createdAt.toISOString(),
		editedAt: row.editedAt?.toISOString() ?? null,
		author: { id: row.authorId, name: row.authorName, image: row.authorImage }
	};
}

function whereTarget(target: MessageTarget) {
	return 'channelId' in target
		? eq(message.channelId, target.channelId)
		: eq(message.conversationId, target.conversationId);
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
	return rows.reverse().map(toChatMessage);
}

export async function createMessage(
	target: MessageTarget,
	authorId: string,
	content: string
): Promise<ChatMessage> {
	const [inserted] = await db
		.insert(message)
		.values({ ...target, authorId, content })
		.returning({ id: message.id });

	const [row] = await db
		.select(columns)
		.from(message)
		.innerJoin(user, eq(message.authorId, user.id))
		.where(eq(message.id, inserted.id));
	return toChatMessage(row);
}
