import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { hasChat } from '#lib/channels.ts';
import type { ChatMessage } from '#lib/chat.ts';
import type { UnreadCount, UnreadCounts } from '#lib/unread.ts';
import { listVisibleChannelIds } from '#lib/server/channels.ts';
import { db } from '#lib/server/db/index.ts';
import {
	conversationMember,
	message,
	messageMention,
	readState,
	user
} from '#lib/server/db/schema.ts';
import { publish, userTopic } from '#lib/server/realtime.ts';

/** Topic of the `message.activity` events of all channels, see `/api/me/events`. */
export const CHANNEL_ACTIVITY_TOPIC = 'channels';

const counts = {
	count: sql<number>`count(*)::int`,
	mentions: sql<number>`count(${messageMention.userId})::int`
};

function toRecord(rows: { id: string | null; count: number; mentions: number }[]) {
	const record: Record<string, UnreadCount> = {};
	for (const { id, ...c } of rows) if (id) record[id] = c;
	return record;
}

/**
 * Unread messages from others in every channel the user can see and every conversation they are
 * in. Without a read marker, messages since the user signed up (or joined the group) count.
 */
export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
	const readSince = sql`coalesce(${readState.lastReadAt}, (select ${user.createdAt} from ${user} where ${user.id} = ${userId}))`;
	const mentionsMe = and(
		eq(messageMention.messageId, message.id),
		eq(messageMention.userId, userId)
	);

	const [channelRows, conversationRows, visible] = await Promise.all([
		db
			.select({ id: message.channelId, ...counts })
			.from(message)
			.leftJoin(
				readState,
				and(eq(readState.userId, userId), eq(readState.channelId, message.channelId))
			)
			.leftJoin(messageMention, mentionsMe)
			.where(
				and(
					isNotNull(message.channelId),
					ne(message.authorId, userId),
					sql`${message.createdAt} > ${readSince}`
				)
			)
			.groupBy(message.channelId),
		db
			.select({ id: message.conversationId, ...counts })
			.from(message)
			.innerJoin(
				conversationMember,
				and(
					eq(conversationMember.conversationId, message.conversationId),
					eq(conversationMember.userId, userId)
				)
			)
			.leftJoin(
				readState,
				and(eq(readState.userId, userId), eq(readState.conversationId, message.conversationId))
			)
			.leftJoin(messageMention, mentionsMe)
			.where(
				and(
					ne(message.authorId, userId),
					sql`${message.createdAt} > coalesce(${readState.lastReadAt}, ${conversationMember.joinedAt})`
				)
			)
			.groupBy(message.conversationId),
		listVisibleChannelIds(userId, hasChat)
	]);

	return {
		channels: toRecord(channelRows.filter((r) => r.id !== null && visible.has(r.id))),
		conversations: toRecord(conversationRows)
	};
}

/** Tells the clients that may care about a new message to reload their unread counts. */
export async function notifyActivity(sent: ChatMessage): Promise<void> {
	if (sent.channelId !== null) {
		publish(CHANNEL_ACTIVITY_TOPIC, {
			type: 'message.activity',
			authorId: sent.author.id,
			mentionIds: sent.mentions.map((u) => u.id),
			channelId: sent.channelId,
			conversationId: null
		});
		return;
	}
	if (sent.conversationId === null) return;
	const members = await db
		.select({ userId: conversationMember.userId })
		.from(conversationMember)
		.where(eq(conversationMember.conversationId, sent.conversationId));
	for (const { userId } of members) {
		if (userId === sent.author.id) continue;
		publish(userTopic(userId), {
			type: 'message.activity',
			authorId: sent.author.id,
			mentionIds: sent.mentions.map((u) => u.id),
			channelId: null,
			conversationId: sent.conversationId
		});
	}
}
