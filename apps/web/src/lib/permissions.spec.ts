import { describe, expect, it } from 'vitest';
import {
	applyGuestRules,
	applyOverwrite,
	DEFAULT_PERMISSIONS,
	hasPermission,
	Permission,
	resolvePermissions
} from './permissions.ts';

describe('hasPermission', () => {
	it('grants permissions contained in the mask', () => {
		expect(hasPermission(DEFAULT_PERMISSIONS, Permission.SendMessages)).toBe(true);
		expect(hasPermission(DEFAULT_PERMISSIONS, Permission.Stream)).toBe(true);
	});

	it('denies permissions missing from the mask', () => {
		expect(hasPermission(DEFAULT_PERMISSIONS, Permission.ManageServer)).toBe(false);
		expect(hasPermission(0n, Permission.ViewChannel)).toBe(false);
	});

	it('requires every bit of a combined permission', () => {
		const both = Permission.Connect | Permission.MuteMembers;
		expect(hasPermission(Permission.Connect, both)).toBe(false);
		expect(hasPermission(both, both)).toBe(true);
	});

	it('lets administrators do everything', () => {
		expect(hasPermission(Permission.Administrator, Permission.BanMembers)).toBe(true);
	});
});

describe('applyOverwrite', () => {
	it('removes denied and adds allowed permissions', () => {
		const result = applyOverwrite(
			DEFAULT_PERMISSIONS,
			Permission.ManageMessages,
			Permission.SendMessages
		);
		expect(hasPermission(result, Permission.SendMessages)).toBe(false);
		expect(hasPermission(result, Permission.ManageMessages)).toBe(true);
		expect(hasPermission(result, Permission.ViewChannel)).toBe(true);
	});

	it('lets allow win when a bit is both allowed and denied', () => {
		const result = applyOverwrite(0n, Permission.Speak, Permission.Speak);
		expect(hasPermission(result, Permission.Speak)).toBe(true);
	});
});

describe('resolvePermissions', () => {
	it('gives the owner every permission', () => {
		const mask = resolvePermissions({ isOwner: true, rolePermissions: [] });
		expect(hasPermission(mask, Permission.BanMembers)).toBe(true);
	});

	it('combines all roles of a user', () => {
		const mask = resolvePermissions({
			isOwner: false,
			rolePermissions: [DEFAULT_PERMISSIONS, Permission.ManageMessages]
		});
		expect(hasPermission(mask, Permission.SendMessages)).toBe(true);
		expect(hasPermission(mask, Permission.ManageMessages)).toBe(true);
	});

	it('applies role overwrites, letting an allow on one role beat a deny on another', () => {
		const mask = resolvePermissions({
			isOwner: false,
			rolePermissions: [DEFAULT_PERMISSIONS],
			roleOverwrites: [
				{ allow: 0n, deny: Permission.SendMessages },
				{ allow: Permission.SendMessages, deny: 0n }
			]
		});
		expect(hasPermission(mask, Permission.SendMessages)).toBe(true);
	});

	it('lets a user overwrite win over role overwrites', () => {
		const mask = resolvePermissions({
			isOwner: false,
			rolePermissions: [DEFAULT_PERMISSIONS],
			roleOverwrites: [{ allow: Permission.SendMessages, deny: 0n }],
			userOverwrite: { allow: 0n, deny: Permission.SendMessages }
		});
		expect(hasPermission(mask, Permission.SendMessages)).toBe(false);
	});

	it('ignores channel overwrites for administrators', () => {
		const mask = resolvePermissions({
			isOwner: false,
			rolePermissions: [Permission.Administrator],
			userOverwrite: { allow: 0n, deny: Permission.ViewChannel }
		});
		expect(hasPermission(mask, Permission.ViewChannel)).toBe(true);
	});
});

describe('applyGuestRules', () => {
	it('keeps guests on a private server from inviting people', () => {
		const mask = applyGuestRules(DEFAULT_PERMISSIONS, { isGuest: true, isPublic: false });
		expect(hasPermission(mask, Permission.CreateInvite)).toBe(false);
		expect(hasPermission(mask, Permission.SendMessages)).toBe(true);
	});

	it('changes nothing for members or on a public server', () => {
		expect(applyGuestRules(DEFAULT_PERMISSIONS, { isGuest: false, isPublic: false })).toBe(
			DEFAULT_PERMISSIONS
		);
		expect(applyGuestRules(DEFAULT_PERMISSIONS, { isGuest: true, isPublic: true })).toBe(
			DEFAULT_PERMISSIONS
		);
	});
});
