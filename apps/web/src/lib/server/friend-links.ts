import { eq } from 'drizzle-orm';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions } from '#lib/server/channels.ts';
import { db } from '#lib/server/db/index.ts';
import { friendLink, user } from '#lib/server/db/schema.ts';
import { generateInviteCode } from '#lib/server/invite-code.ts';

/** The user's personal friend link code, created on first use. */
export async function getFriendLinkCode(userId: string): Promise<string> {
	const [existing] = await db
		.select({ code: friendLink.code })
		.from(friendLink)
		.where(eq(friendLink.userId, userId));
	if (existing) return existing.code;

	await db.insert(friendLink).values({ userId, code: generateInviteCode() }).onConflictDoNothing();
	const [row] = await db
		.select({ code: friendLink.code })
		.from(friendLink)
		.where(eq(friendLink.userId, userId));
	return row.code;
}

/** Replaces the user's friend link with a new one. The old link stops working. */
export async function resetFriendLink(userId: string): Promise<string> {
	const code = generateInviteCode();
	await db
		.insert(friendLink)
		.values({ userId, code })
		.onConflictDoUpdate({ target: friendLink.userId, set: { code, createdAt: new Date() } });
	return code;
}

/** Who a friend link belongs to, or null if the link is unknown or was reset. */
export async function getFriendLinkOwner(code: string) {
	const [row] = await db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(friendLink)
		.innerJoin(user, eq(user.id, friendLink.userId))
		.where(eq(friendLink.code, code));
	return row ?? null;
}

/**
 * Newcomers can join the instance through a friend link only if its owner may invite people,
 * the same rule as for invite links. Members can always use it to become friends.
 */
export async function friendLinkAdmitsNewUsers(ownerId: string): Promise<boolean> {
	return hasPermission(await getServerPermissions(ownerId), Permission.CreateInvite);
}
