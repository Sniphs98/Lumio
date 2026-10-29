import { describe, expect, it } from 'vitest';
import { hasItems, userMenuItems, type UserMenuAccess } from './user-menu.ts';

const access: UserMenuAccess = {
	meId: 'me',
	friendIds: new Set(['friend']),
	members: new Map([
		['friend', { canKick: true, canBan: false, isGuest: false }],
		['troll', { canKick: true, canBan: true, isGuest: true }],
		// The server never sends the user themselves, but the menu must not offer it anyway.
		['me', { canKick: true, canBan: true, isGuest: false }]
	])
};

describe('userMenuItems', () => {
	it('offers a direct message to friends only', () => {
		expect(userMenuItems('friend', access, false).message).toBe(true);
		expect(userMenuItems('troll', access, false).message).toBe(false);
	});

	it('offers kick and ban only where the server allows them', () => {
		expect(userMenuItems('friend', access, false)).toMatchObject({ kick: true, ban: false });
		expect(userMenuItems('troll', access, false)).toMatchObject({ kick: true, ban: true });
		expect(userMenuItems('owner', access, false)).toMatchObject({ kick: false, ban: false });
	});

	it('offers nothing but mentioning for the user themselves', () => {
		expect(userMenuItems('me', access, true)).toEqual({
			message: false,
			mention: true,
			kick: false,
			ban: false
		});
		expect(hasItems(userMenuItems('me', access, false))).toBe(false);
	});

	it('only offers mentioning without access, e.g. in a direct message', () => {
		expect(userMenuItems('friend', undefined, true)).toEqual({
			message: false,
			mention: true,
			kick: false,
			ban: false
		});
		expect(hasItems(userMenuItems('friend', undefined, false))).toBe(false);
	});
});
