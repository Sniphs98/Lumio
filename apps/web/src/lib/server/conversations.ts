import { aliasedTable, and, asc, eq, ne } from 'drizzle-orm';
import { directKey, type FriendUser } from '#lib/friends.ts';
import { groupTitle } from '#lib/groups.ts';
import { areFriends } from '#lib/server/friends.ts';
import { db } from '#lib/server/db/index.ts';
import { conversation, conversationMember, user } from '#lib/server/db/schema.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the direct conversation of two users, creating it on first use. */
export async function getOrCreateDirectConversation(a: string, b: string): Promise<string> {
	const key = directKey(a, b);
	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(conversation)
			.values({ type: 'direct', directKey: key })
			.onConflictDoNothing({ target: conversation.directKey })
			.returning({ id: conversation.id });
		if (created) {
			await tx.insert(conversationMember).values([
				{ conversationId: created.id, userId: a },
				{ conversationId: created.id, userId: b }
			]);
			return created.id;
		}
		const [existing] = await tx
			.select({ id: conversation.id })
			.from(conversation)
			.where(eq(conversation.directKey, key));
		return existing.id;
	});
}

/** Maps each user that `userId` has a direct conversation with to that conversation's id. */
export async function listDirectConversationIds(userId: string): Promise<Record<string, string>> {
	const me = aliasedTable(conversationMember, 'me');
	const other = aliasedTable(conversationMember, 'other');
	const rows = await db
		.select({ conversationId: conversation.id, otherId: other.userId })
		.from(conversation)
		.innerJoin(me, and(eq(me.conversationId, conversation.id), eq(me.userId, userId)))
		.innerJoin(other, and(eq(other.conversationId, conversation.id), ne(other.userId, userId)))
		.where(eq(conversation.type, 'direct'));
	return Object.fromEntries(rows.map((r) => [r.otherId, r.conversationId]));
}

export type GroupSummary = { id: string; title: string; memberCount: number };

/** Group conversations the user is a member of, oldest first. */
export async function listGroupConversations(userId: string): Promise<GroupSummary[]> {
	const me = aliasedTable(conversationMember, 'me');
	const groups = await db
		.select({ id: conversation.id, name: conversation.name })
		.from(conversation)
		.innerJoin(me, and(eq(me.conversationId, conversation.id), eq(me.userId, userId)))
		.where(eq(conversation.type, 'group'))
		.orderBy(asc(conversation.createdAt));
	if (groups.length === 0) return [];

	// Names of the other members, for groups without a name of their own.
	const others = await db
		.select({ conversationId: conversationMember.conversationId, name: user.name })
		.from(conversationMember)
		.innerJoin(
			me,
			and(eq(me.conversationId, conversationMember.conversationId), eq(me.userId, userId))
		)
		.innerJoin(user, eq(user.id, conversationMember.userId))
		.where(ne(conversationMember.userId, userId))
		.orderBy(asc(user.name));
	const byGroup = Map.groupBy(others, (o) => o.conversationId);

	return groups.map((g) => {
		const members = byGroup.get(g.id) ?? [];
		return { id: g.id, title: groupTitle(g.name, members), memberCount: members.length + 1 };
	});
}

export type ConversationDetails = {
	id: string;
	type: 'direct' | 'group';
	name: string | null;
	/** Group conversations only: the member who may remove others. */
	ownerId: string | null;
	/** Everyone in the conversation except the user asking. */
	others: FriendUser[];
};

/** A conversation with its members, or null if it does not exist or `userId` is not a member. */
export async function getConversation(
	conversationId: string,
	userId: string
): Promise<ConversationDetails | null> {
	if (!UUID.test(conversationId)) return null;

	const [row] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
	if (!row) return null;

	const members = await db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(conversationMember)
		.innerJoin(user, eq(user.id, conversationMember.userId))
		.where(eq(conversationMember.conversationId, conversationId))
		.orderBy(asc(user.name));
	if (!members.some((m) => m.id === userId)) return null;

	return {
		id: row.id,
		type: row.type,
		name: row.name,
		ownerId: row.ownerId,
		others: members.filter((m) => m.id !== userId)
	};
}

/** Direct messages need an accepted friendship; group members can always write. */
export async function canSendInConversation(
	details: ConversationDetails,
	userId: string
): Promise<boolean> {
	if (details.type === 'group') return true;
	return details.others.length === 1 && areFriends(userId, details.others[0].id);
}
