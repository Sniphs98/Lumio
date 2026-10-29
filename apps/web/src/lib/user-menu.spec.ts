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
		expect(userMenuItems('friend', access).message).toBe(true);
		expect(userMenuItems('troll', access).message).toBe(false);
	});

	it('offers kick and ban only where the server allows them', () => {
		expect(userMenuItems('friend', access)).toMatchObject({ kick: true, ban: false });
		expect(userMenuItems('troll', access)).toMatchObject({ kick: true, ban: true });
		expect(userMenuItems('owner', access)).toMatchObject({ kick: false, ban: false });
	});

	it('offers nothing but mentioning for the user themselves', () => {
		expect(userMenuItems('me', access, { mention: true })).toEqual({
			message: false,
			mention: true,
			volume: false,
			kick: false,
			ban: false
		});
		expect(hasItems(userMenuItems('me', access))).toBe(false);
	});

	it('only offers mentioning without access, e.g. in a direct message', () => {
		expect(userMenuItems('friend', undefined, { mention: true })).toEqual({
			message: false,
			mention: true,
			volume: false,
			kick: false,
			ban: false
		});
		expect(hasItems(userMenuItems('friend', undefined))).toBe(false);
	});

	it('offers the volume in voice for everyone but the user themselves', () => {
		expect(userMenuItems('troll', access, { voice: true }).volume).toBe(true);
		expect(userMenuItems('me', access, { voice: true }).volume).toBe(false);
		expect(userMenuItems('troll', access).volume).toBe(false);
		// In a direct call there is no server, the call tile leaves out the user themselves.
		expect(userMenuItems('friend', undefined, { voice: true }).volume).toBe(true);
	});
});
