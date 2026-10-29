import { describe, expect, it } from 'vitest';
import { moderationError, parseBanReason } from './moderation.ts';
import { DEFAULT_PERMISSIONS, Permission } from './permissions.ts';

const moderator = {
	id: 'mod',
	isOwner: false,
	permissions: DEFAULT_PERMISSIONS | Permission.KickMembers | Permission.BanMembers
};
const member = { id: 'member', isOwner: false, permissions: DEFAULT_PERMISSIONS };
const owner = { id: 'owner', isOwner: true, permissions: Permission.Administrator };
const admin = { id: 'admin', isOwner: false, permissions: Permission.Administrator };

describe('moderationError', () => {
	it('lets moderators kick and ban members', () => {
		expect(moderationError('kick', moderator, member)).toBeNull();
		expect(moderationError('ban', moderator, member)).toBeNull();
	});

	it('needs the matching permission', () => {
		expect(moderationError('kick', member, moderator)).toBe('You cannot kick members.');
		const kicker = { ...member, permissions: DEFAULT_PERMISSIONS | Permission.KickMembers };
		expect(moderationError('ban', kicker, member)).toBe('You cannot ban members.');
	});

	it('protects the owner, administrators and the moderator themselves', () => {
		expect(moderationError('ban', moderator, moderator)).toBe('You cannot ban yourself.');
		expect(moderationError('kick', admin, owner)).toBe('The owner cannot be kicked.');
		expect(moderationError('ban', moderator, admin)).toBe(
			'Only the owner can do that to an administrator.'
		);
		expect(moderationError('ban', owner, admin)).toBeNull();
	});
});

describe('parseBanReason', () => {
	it('trims the reason and treats an empty one as none', () => {
		expect(parseBanReason('  spam   links ')).toEqual({ ok: true, reason: 'spam links' });
		expect(parseBanReason('')).toEqual({ ok: true, reason: null });
		expect(parseBanReason(null)).toEqual({ ok: true, reason: null });
		expect(parseBanReason('x'.repeat(201)).ok).toBe(false);
	});
});
