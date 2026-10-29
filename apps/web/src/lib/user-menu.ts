/** What the right-click menu on a user offers, used by `UserContextMenu`. */
import { createContext } from 'svelte';
import type { ModerationAction } from '#lib/moderation.ts';

/** Someone the menu opens for, e.g. a member, a message author or a call participant. */
export type MenuUser = { id: string; name: string };

/** What the signed-in user may do to a member, as loaded by the channels layout. */
export type MemberAccess = { canKick: boolean; canBan: boolean; isGuest: boolean };

/** What the signed-in user may do to others. */
export type UserMenuAccess = {
	meId: string;
	/** Friends can be messaged directly. */
	friendIds: ReadonlySet<string>;
	/** Only members the user may kick or ban are in here. */
	members: ReadonlyMap<string, MemberAccess>;
};

export type UserMenuItems = { message: boolean; mention: boolean; kick: boolean; ban: boolean };

/** The menu items for `userId`. Without access, e.g. outside a server, only mentioning is left. */
export function userMenuItems(
	userId: string,
	access: UserMenuAccess | undefined,
	canMention: boolean
): UserMenuItems {
	const member = access?.members.get(userId);
	const other = access !== undefined && userId !== access.meId;
	return {
		message: other && access.friendIds.has(userId),
		mention: canMention,
		kick: other && member?.canKick === true,
		ban: other && member?.canBan === true
	};
}

export function hasItems(items: UserMenuItems): boolean {
	return items.message || items.mention || items.kick || items.ban;
}

/** Set by the channels layout, which also shows the kick and ban confirmations. */
export const [getUserMenuContext, setUserMenuContext, hasUserMenuContext] = createContext<{
	readonly access: UserMenuAccess;
	/** Asks the user to confirm kicking or banning someone. */
	moderate(action: ModerationAction, user: MenuUser): void;
}>();
