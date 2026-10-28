import { and, asc, eq } from 'drizzle-orm';
import { checkNewMembers } from '#lib/groups.ts';
import { getConversation, type ConversationDetails } from '#lib/server/conversations.ts';
import { db } from '#lib/server/db/index.ts';
import { conversation, conversationMember } from '#lib/server/db/schema.ts';
import { getFriendLists } from '#lib/server/friends.ts';
import { publish, userTopic } from '#lib/server/realtime.ts';

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Tells these users to reload their Home tab, e.g. the group list and an open group. */
function notify(userIds: string[]) {
	for (const id of userIds) publish(userTopic(id), { type: 'home.changed' });
}

async function friendIds(userId: string): Promise<Set<string>> {
	const { friends } = await getFriendLists(userId);
	return new Set(friends.map((f) => f.id));
}

/** The group `userId` is a member of, or null if there is none or it is a direct conversation. */
export async function getGroup(
	conversationId: string,
	userId: string
): Promise<ConversationDetails | null> {
	const details = await getConversation(conversationId, userId);
	return details?.type === 'group' ? details : null;
}

/** Creates a group chat of `ownerId` and some of their friends. */
export async function createGroup(
	ownerId: string,
	name: string | null,
	memberIds: string[]
): Promise<Result<{ id: string }>> {
	const ids = memberIds.filter((id) => id !== ownerId);
	const check = checkNewMembers(ids, await friendIds(ownerId), 1);
	if (!check.ok) return check;

	const id = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(conversation)
			.values({ type: 'group', name, ownerId })
			.returning({ id: conversation.id });
		await tx
			.insert(conversationMember)
			.values([ownerId, ...ids].map((userId) => ({ conversationId: created.id, userId })));
		return created.id;
	});
	notify([ownerId, ...ids]);
	return { ok: true, id };
}

/** Renames a group. Every member may do that; null removes the name. */
export async function renameGroup(group: ConversationDetails, userId: string, name: string | null) {
	await db.update(conversation).set({ name }).where(eq(conversation.id, group.id));
	notify([userId, ...group.others.map((o) => o.id)]);
}

/** Adds friends of `userId` to a group they are in. */
export async function addGroupMembers(
	group: ConversationDetails,
	userId: string,
	memberIds: string[]
): Promise<Result> {
	const current = new Set([userId, ...group.others.map((o) => o.id)]);
	const ids = memberIds.filter((id) => !current.has(id));
	const check = checkNewMembers(ids, await friendIds(userId), current.size);
	if (!check.ok) return check;

	await db
		.insert(conversationMember)
		.values(ids.map((id) => ({ conversationId: group.id, userId: id })))
		.onConflictDoNothing();
	notify([...current, ...ids]);
	return { ok: true };
}

/**
 * Takes a member out of a group. Called with their own id when they leave; only the owner
 * may remove someone else. When the owner leaves, the longest-standing member becomes the
 * owner, and a group that nobody is left in is deleted.
 */
export async function removeGroupMember(
	group: ConversationDetails,
	userId: string,
	memberId: string
): Promise<Result> {
	const leaving = memberId === userId;
	if (!leaving && group.ownerId !== userId) {
		return { ok: false, error: 'Only the owner of the group can remove members.' };
	}
	if (!leaving && !group.others.some((o) => o.id === memberId)) {
		return { ok: false, error: 'This person is not in the group.' };
	}

	await db.transaction(async (tx) => {
		await tx
			.delete(conversationMember)
			.where(
				and(
					eq(conversationMember.conversationId, group.id),
					eq(conversationMember.userId, memberId)
				)
			);
		const [next] = await tx
			.select({ userId: conversationMember.userId })
			.from(conversationMember)
			.where(eq(conversationMember.conversationId, group.id))
			.orderBy(asc(conversationMember.joinedAt), asc(conversationMember.userId))
			.limit(1);
		if (!next) {
			await tx.delete(conversation).where(eq(conversation.id, group.id));
		} else if (group.ownerId === memberId || group.ownerId === null) {
			await tx
				.update(conversation)
				.set({ ownerId: next.userId })
				.where(eq(conversation.id, group.id));
		}
	});

	publish(group.id, { type: 'member.removed', userId: memberId });
	publish(userTopic(memberId), { type: 'conversation.removed', conversationId: group.id });
	notify([userId, ...group.others.map((o) => o.id)].filter((id) => id !== memberId));
	return { ok: true };
}

/** Friends of `userId` who are not in the group yet, for the "Add people" list. */
export async function listAddableFriends(group: ConversationDetails, userId: string) {
	const { friends } = await getFriendLists(userId);
	const members = new Set(group.others.map((o) => o.id));
	return friends.filter((f) => !members.has(f.id));
}
