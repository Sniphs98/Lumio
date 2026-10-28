import { describe, expect, it } from 'vitest';
import { applyOverwrite, DEFAULT_PERMISSIONS, hasPermission, Permission } from './permissions.ts';

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
