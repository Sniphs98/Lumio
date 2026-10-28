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
