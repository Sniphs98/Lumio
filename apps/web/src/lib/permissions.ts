/**
 * Permission bits, stored as a bigint bit mask on roles and channel overwrites.
 * Never reorder existing entries: the bit positions are persisted in the database.
 */
export const Permission = {
	Administrator: 1n << 0n,
	ViewChannel: 1n << 1n,
	ManageServer: 1n << 2n,
	ManageChannels: 1n << 3n,
	ManageRoles: 1n << 4n,
	CreateInvite: 1n << 5n,
	KickMembers: 1n << 6n,
	BanMembers: 1n << 7n,
	SendMessages: 1n << 8n,
	ManageMessages: 1n << 9n,
	AttachFiles: 1n << 10n,
	AddReactions: 1n << 11n,
	Connect: 1n << 12n,
	Speak: 1n << 13n,
	Stream: 1n << 14n,
	MuteMembers: 1n << 15n
} as const;

export type PermissionName = keyof typeof Permission;

/** Default permissions of the `@everyone` role on a new server. */
export const DEFAULT_PERMISSIONS =
	Permission.ViewChannel |
	Permission.CreateInvite |
	Permission.SendMessages |
	Permission.AttachFiles |
	Permission.AddReactions |
	Permission.Connect |
	Permission.Speak |
	Permission.Stream;

export function hasPermission(mask: bigint, permission: bigint): boolean {
	if ((mask & Permission.Administrator) === Permission.Administrator) return true;
	return (mask & permission) === permission;
}

/** Applies a channel overwrite on top of a base permission mask. */
export function applyOverwrite(base: bigint, allow: bigint, deny: bigint): bigint {
	return (base & ~deny) | allow;
}

export type Overwrite = { allow: bigint; deny: bigint };

/**
 * Computes a user's effective permissions in a channel, following Discord's order:
 * role permissions, then role overwrites (all denies, then all allows), then the user's own overwrite.
 * The instance owner always has every permission.
 */
export function resolvePermissions(input: {
	isOwner: boolean;
	rolePermissions: bigint[];
	roleOverwrites?: Overwrite[];
	userOverwrite?: Overwrite | null;
}): bigint {
	if (input.isOwner) return Permission.Administrator;

	let mask = input.rolePermissions.reduce((acc, p) => acc | p, 0n);
	if ((mask & Permission.Administrator) === Permission.Administrator) return mask;

	const roleOverwrites = input.roleOverwrites ?? [];
	const deny = roleOverwrites.reduce((acc, o) => acc | o.deny, 0n);
	const allow = roleOverwrites.reduce((acc, o) => acc | o.allow, 0n);
	mask = applyOverwrite(mask, allow, deny);

	if (input.userOverwrite) {
		mask = applyOverwrite(mask, input.userOverwrite.allow, input.userOverwrite.deny);
	}
	return mask;
}

/**
 * Guests on a private server (the default) cannot bring in new people: they cannot create
 * invite links, and their friend links only work for existing members. On a public server
 * guests have the same permissions as members.
 */
export function applyGuestRules(
	mask: bigint,
	{ isGuest, isPublic }: { isGuest: boolean; isPublic: boolean }
): bigint {
	if (!isGuest || isPublic) return mask;
	if ((mask & Permission.Administrator) === Permission.Administrator) return mask;
	return mask & ~Permission.CreateInvite;
}
