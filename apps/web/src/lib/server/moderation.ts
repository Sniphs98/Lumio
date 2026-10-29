import { asc, desc, eq } from 'drizzle-orm';
import { moderationError, type ModerationAction } from '#lib/moderation.ts';
import { getServerPermissions, isInstanceOwner } from '#lib/server/channels.ts';
import { db } from '#lib/server/db/index.ts';
import { getInstance } from '#lib/server/instance.ts';
import { ban, session, user } from '#lib/server/db/schema.ts';
import { publish, sessionTopic, userTopic } from '#lib/server/realtime.ts';
import { removeFromCalls } from '#lib/server/voice.ts';

type Result = { ok: true } | { ok: false; error: string };

export type MemberRow = { id: string; name: string; isGuest: boolean; isOwner: boolean };
export type BanRow = { userId: string; name: string; reason: string | null; createdAt: Date };

/** Everyone in the instance who is not banned, by name. */
export async function listMembers(): Promise<MemberRow[]> {
	const [rows, bans, inst] = await Promise.all([
		db
			.select({ id: user.id, name: user.name, isAnonymous: user.isAnonymous })
			.from(user)
			.orderBy(asc(user.name)),
		db.select({ userId: ban.userId }).from(ban),
		getInstance()
	]);
	const banned = new Set(bans.map((b) => b.userId));
	return rows
		.filter((r) => !banned.has(r.id))
		.map((r) => ({
			id: r.id,
			name: r.name,
			isGuest: r.isAnonymous === true,
			isOwner: r.id === inst?.ownerId
		}));
}

export async function listBans(): Promise<BanRow[]> {
	return db
		.select({ userId: ban.userId, name: user.name, reason: ban.reason, createdAt: ban.createdAt })
		.from(ban)
		.innerJoin(user, eq(user.id, ban.userId))
		.orderBy(desc(ban.createdAt));
}

export async function isBanned(userId: string): Promise<boolean> {
	const [row] = await db.select({ userId: ban.userId }).from(ban).where(eq(ban.userId, userId));
	return row !== undefined;
}

async function checkAllowed(
	action: ModerationAction,
	actorId: string,
	targetId: string
): Promise<string | null> {
	const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId));
	if (!target) return 'This person is not on the server.';
	const [actorOwner, actorPermissions, targetOwner, targetPermissions] = await Promise.all([
		isInstanceOwner(actorId),
		getServerPermissions(actorId),
		isInstanceOwner(targetId),
		getServerPermissions(targetId)
	]);
	return moderationError(
		action,
		{ id: actorId, isOwner: actorOwner, permissions: actorPermissions },
		{ id: targetId, isOwner: targetOwner, permissions: targetPermissions }
	);
}

/**
 * Signs a user out on every device: their sessions are deleted, their open pages are told and
 * their event streams end, and they are taken out of every call.
 */
async function endSessions(userId: string): Promise<void> {
	await db.delete(session).where(eq(session.userId, userId));
	publish(userTopic(userId), { type: 'session.revoked' });
	publish(sessionTopic(userId), { type: 'session.revoked' });
	await removeFromCalls(userId);
}

/**
 * Kicks a member: they are signed out everywhere. Guests have no password, so they lose access
 * for good; members with an account can sign in again.
 */
export async function kickMember(actorId: string, targetId: string): Promise<Result> {
	const error = await checkAllowed('kick', actorId, targetId);
	if (error) return { ok: false, error };
	await endSessions(targetId);
	return { ok: true };
}

/** Bans a member: they are signed out everywhere and cannot sign in until they are unbanned. */
export async function banMember(
	actorId: string,
	targetId: string,
	reason: string | null
): Promise<Result> {
	const error = await checkAllowed('ban', actorId, targetId);
	if (error) return { ok: false, error };
	await db
		.insert(ban)
		.values({ userId: targetId, bannedById: actorId, reason })
		.onConflictDoUpdate({ target: ban.userId, set: { bannedById: actorId, reason } });
	await endSessions(targetId);
	return { ok: true };
}

/** Lifts a ban. Returns false if the user was not banned. */
export async function unbanMember(userId: string): Promise<boolean> {
	const deleted = await db.delete(ban).where(eq(ban.userId, userId)).returning();
	return deleted.length > 0;
}
