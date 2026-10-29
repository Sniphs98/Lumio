/** Who may kick or ban whom, used on the server and in the browser. */
import { hasPermission, Permission } from '#lib/permissions.ts';

export const BAN_REASON_MAX_LENGTH = 200;

export type ModerationAction = 'kick' | 'ban';

const REQUIRED: Record<ModerationAction, bigint> = {
	kick: Permission.KickMembers,
	ban: Permission.BanMembers
};

/**
 * Whether `actor` may kick or ban `target`. Nobody can act on themselves or on the owner, and
 * only the owner can act on administrators. Returns an error text, or null if it is allowed.
 */
export function moderationError(
	action: ModerationAction,
	actor: { id: string; isOwner: boolean; permissions: bigint },
	target: { id: string; isOwner: boolean; permissions: bigint }
): string | null {
	if (!hasPermission(actor.permissions, REQUIRED[action])) {
		return action === 'kick' ? 'You cannot kick members.' : 'You cannot ban members.';
	}
	if (actor.id === target.id) return `You cannot ${action} yourself.`;
	if (target.isOwner) return `The owner cannot be ${action === 'kick' ? 'kicked' : 'banned'}.`;
	if (!actor.isOwner && hasPermission(target.permissions, Permission.Administrator)) {
		return 'Only the owner can do that to an administrator.';
	}
	return null;
}

/** Reads the optional reason of the ban form. */
export function parseBanReason(
	raw: unknown
): { ok: true; reason: string | null } | { ok: false; error: string } {
	const reason = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
	if (reason.length > BAN_REASON_MAX_LENGTH) {
		return { ok: false, error: `Reasons can be at most ${BAN_REASON_MAX_LENGTH} characters long.` };
	}
	return { ok: true, reason: reason === '' ? null : reason };
}
