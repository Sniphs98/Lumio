import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { sortFriendships, type FriendLists, type FriendUser } from '#lib/friends.ts';
import { db } from '#lib/server/db/index.ts';
import { friendship, user } from '#lib/server/db/schema.ts';
import { publish, userTopic } from '#lib/server/realtime.ts';

const userColumns = { id: user.id, name: user.name, image: user.image };

/** Rows of the pair (a, b), whoever sent the request. */
function pair(a: string, b: string) {
	return or(
		and(eq(friendship.requesterId, a), eq(friendship.addresseeId, b)),
		and(eq(friendship.requesterId, b), eq(friendship.addresseeId, a))
	);
}

/** Tells both users to reload their friend lists. */
function notify(...userIds: string[]) {
	for (const id of userIds) publish(userTopic(id), { type: 'home.changed' });
}

export async function getFriendLists(userId: string): Promise<FriendLists> {
	const rows = await db
		.select({
			requesterId: friendship.requesterId,
			addresseeId: friendship.addresseeId,
			status: friendship.status
		})
		.from(friendship)
		.where(or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)));

	const otherIds = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
	const users: FriendUser[] =
		otherIds.length > 0
			? await db.select(userColumns).from(user).where(inArray(user.id, otherIds))
			: [];

	return sortFriendships(userId, rows, new Map(users.map((u) => [u.id, u])));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
	const [row] = await db.select({ status: friendship.status }).from(friendship).where(pair(a, b));
	return row?.status === 'accepted';
}

/**
 * Sends a friend request to the user with this email. If that user already sent us
 * a request, it is accepted instead.
 */
export async function sendFriendRequest(
	userId: string,
	email: string
): Promise<{ ok: true; friend: FriendUser; accepted: boolean } | { ok: false; error: string }> {
	const [other] = await db
		.select(userColumns)
		.from(user)
		.where(eq(sql`lower(${user.email})`, email.toLowerCase()));
	if (!other) return { ok: false, error: 'Nobody on this Lumio uses that email address.' };
	if (other.id === userId) return { ok: false, error: 'You cannot add yourself.' };

	const [existing] = await db.select().from(friendship).where(pair(userId, other.id));
	if (existing?.status === 'accepted') {
		return { ok: false, error: `You and ${other.name} are already friends.` };
	}
	if (existing?.status === 'blocked') {
		return { ok: false, error: 'You cannot send a friend request to this user.' };
	}
	if (existing?.requesterId === userId) {
		return { ok: false, error: `You already sent ${other.name} a friend request.` };
	}
	if (existing) {
		await acceptFriendRequest(userId, other.id);
		return { ok: true, friend: other, accepted: true };
	}

	await db
		.insert(friendship)
		.values({ requesterId: userId, addresseeId: other.id })
		.onConflictDoNothing();
	notify(userId, other.id);
	return { ok: true, friend: other, accepted: false };
}

/** Accepts the pending request `requesterId` sent to `userId`. Returns false if there is none. */
export async function acceptFriendRequest(userId: string, requesterId: string): Promise<boolean> {
	const updated = await db
		.update(friendship)
		.set({ status: 'accepted' })
		.where(
			and(
				eq(friendship.requesterId, requesterId),
				eq(friendship.addresseeId, userId),
				eq(friendship.status, 'pending')
			)
		)
		.returning({ requesterId: friendship.requesterId });
	if (updated.length === 0) return false;
	notify(userId, requesterId);
	return true;
}

/**
 * Declines or cancels a pending request, or removes a friend. Blocks stay in place.
 * Returns false if there was nothing to remove.
 */
export async function removeFriendship(userId: string, otherId: string): Promise<boolean> {
	const deleted = await db
		.delete(friendship)
		.where(and(pair(userId, otherId), inArray(friendship.status, ['pending', 'accepted'])))
		.returning({ requesterId: friendship.requesterId });
	if (deleted.length === 0) return false;
	notify(userId, otherId);
	return true;
}
