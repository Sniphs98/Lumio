import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { inviteState, type InviteSettings } from '#lib/invites.ts';
import { db } from '#lib/server/db/index.ts';
import { invite, user } from '#lib/server/db/schema.ts';
import { getInstance } from '#lib/server/instance.ts';
import { generateInviteCode } from '#lib/server/invite-code.ts';
import { friendLinkAdmitsNewUsers, getFriendLinkOwner } from '#lib/server/friend-links.ts';

/** The link a new user comes through: an invite link of the instance or a member's friend link. */
export type Admission = { kind: 'invite' | 'friend'; code: string };

export type InviteRow = {
	code: string;
	createdById: string;
	createdByName: string;
	uses: number;
	maxUses: number | null;
	expiresAt: Date | null;
	allowGuests: boolean;
	createdAt: Date;
};

export async function createInvite(createdById: string, settings: InviteSettings) {
	const expiresAt =
		settings.expiresInSeconds === null
			? null
			: new Date(Date.now() + settings.expiresInSeconds * 1000);
	const [row] = await db
		.insert(invite)
		.values({
			code: generateInviteCode(),
			createdById,
			maxUses: settings.maxUses,
			expiresAt,
			allowGuests: settings.allowGuests
		})
		.returning();
	return row;
}

/** Links that can still be used, newest first. Pass `createdById` to only list one user's links. */
export async function listActiveInvites(createdById?: string): Promise<InviteRow[]> {
	return db
		.select({
			code: invite.code,
			createdById: invite.createdById,
			createdByName: user.name,
			uses: invite.uses,
			maxUses: invite.maxUses,
			expiresAt: invite.expiresAt,
			allowGuests: invite.allowGuests,
			createdAt: invite.createdAt
		})
		.from(invite)
		.innerJoin(user, eq(user.id, invite.createdById))
		.where(
			and(
				createdById ? eq(invite.createdById, createdById) : undefined,
				or(isNull(invite.expiresAt), gt(invite.expiresAt, sql`now()`)),
				or(isNull(invite.maxUses), lt(invite.uses, invite.maxUses))
			)
		)
		.orderBy(desc(invite.createdAt));
}

/** The invite and who created it, if the link can still be used. */
export async function getValidInvite(code: string) {
	const [row] = await db
		.select({
			code: invite.code,
			uses: invite.uses,
			maxUses: invite.maxUses,
			expiresAt: invite.expiresAt,
			allowGuests: invite.allowGuests,
			createdByName: user.name
		})
		.from(invite)
		.innerJoin(user, eq(user.id, invite.createdById))
		.where(eq(invite.code, code));
	if (!row || inviteState(row) !== 'valid') return null;
	return row;
}

/**
 * Uses up one join of an invite. Checks and counts in one statement, so two people
 * cannot both take the last use. Returns false if the link is unknown, expired or used up,
 * or if a guest wants to join through a link that only allows accounts.
 */
export async function claimInvite(code: string, asGuest = false): Promise<boolean> {
	const claimed = await db
		.update(invite)
		.set({ uses: sql`${invite.uses} + 1` })
		.where(
			and(
				eq(invite.code, code),
				asGuest ? eq(invite.allowGuests, true) : undefined,
				or(isNull(invite.expiresAt), gt(invite.expiresAt, sql`now()`)),
				or(isNull(invite.maxUses), lt(invite.uses, invite.maxUses))
			)
		)
		.returning({ code: invite.code });
	return claimed.length > 0;
}

/**
 * Revokes an invite link. Members can revoke their own links; with `canManageAll`
 * (Manage server) any link. Returns false if there was nothing to revoke.
 */
export async function revokeInvite(
	code: string,
	userId: string,
	canManageAll: boolean
): Promise<boolean> {
	const deleted = await db
		.delete(invite)
		.where(and(eq(invite.code, code), canManageAll ? undefined : eq(invite.createdById, userId)))
		.returning({ code: invite.code });
	return deleted.length > 0;
}

/**
 * Decides whether a new account or guest may be created. Runs before every sign-up.
 * The first user sets up the instance with a full account and needs no invite; everyone
 * after that joins through an invite link (using up one of its joins) or a member's friend
 * link. Returns an error message if the sign-up is not allowed.
 */
export async function admitNewUser(
	admission: Admission | undefined,
	asGuest: boolean
): Promise<string | null> {
	if (!(await getInstance())) {
		return asGuest ? 'The owner of a new Lumio needs a full account.' : null;
	}
	if (!admission) return 'You need an invite link to join this Lumio.';
	if (admission.kind === 'friend') {
		const owner = await getFriendLinkOwner(admission.code);
		if (!owner || !(await friendLinkAdmitsNewUsers(owner.id))) {
			return 'This friend link is invalid or was reset.';
		}
		return null;
	}
	if (!(await claimInvite(admission.code, asGuest))) {
		return asGuest
			? 'This invite link is invalid, has expired or does not allow guests.'
			: 'This invite link is invalid or has expired.';
	}
	return null;
}
