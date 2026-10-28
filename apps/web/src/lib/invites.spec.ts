import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EXPIRY,
	DEFAULT_MAX_USES,
	describeExpiry,
	describeUses,
	inviteState,
	parseInviteSettings
} from './invites.ts';

const now = new Date('2026-10-28T12:00:00Z');
const inHours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

describe('parseInviteSettings', () => {
	it('accepts the listed options', () => {
		expect(parseInviteSettings('3600', '5', 'on')).toEqual({
			ok: true,
			settings: { expiresInSeconds: 3600, maxUses: 5, allowGuests: true }
		});
		expect(parseInviteSettings('never', 'none', 'on')).toEqual({
			ok: true,
			settings: { expiresInSeconds: null, maxUses: null, allowGuests: true }
		});
	});

	it('accepts the defaults', () => {
		expect(parseInviteSettings(DEFAULT_EXPIRY, DEFAULT_MAX_USES, 'on').ok).toBe(true);
	});

	it('only allows guests when the checkbox is checked', () => {
		const settings = parseInviteSettings('3600', '5', null);
		expect(settings.ok && settings.settings.allowGuests).toBe(false);
	});

	it('rejects anything else', () => {
		expect(parseInviteSettings('60', '5', 'on').ok).toBe(false);
		expect(parseInviteSettings('3600', '-1', 'on').ok).toBe(false);
		expect(parseInviteSettings(null, null, null).ok).toBe(false);
	});
});

describe('inviteState', () => {
	it('is valid without limits', () => {
		expect(inviteState({ uses: 40, maxUses: null, expiresAt: null }, now)).toBe('valid');
	});

	it('is valid while uses and time are left', () => {
		expect(inviteState({ uses: 4, maxUses: 5, expiresAt: inHours(1) }, now)).toBe('valid');
	});

	it('is used up once every use is taken', () => {
		expect(inviteState({ uses: 5, maxUses: 5, expiresAt: null }, now)).toBe('used-up');
	});

	it('is expired at and after the expiry time', () => {
		expect(inviteState({ uses: 0, maxUses: null, expiresAt: now }, now)).toBe('expired');
		expect(inviteState({ uses: 0, maxUses: 5, expiresAt: inHours(-1) }, now)).toBe('expired');
	});
});

describe('describeExpiry', () => {
	it('describes links that never expire', () => {
		expect(describeExpiry(null, now)).toBe('Never expires');
	});

	it('uses the largest whole unit', () => {
		expect(describeExpiry(inHours(24 * 7), now)).toBe('Expires in 7 days');
		expect(describeExpiry(inHours(5.5), now)).toBe('Expires in 5 hours');
		expect(describeExpiry(inHours(0.5), now)).toBe('Expires in 30 minutes');
		expect(describeExpiry(new Date(now.getTime() + 10_000), now)).toBe('Expires in 1 minute');
	});

	it('describes expired links', () => {
		expect(describeExpiry(inHours(-1), now)).toBe('Expired');
	});
});

describe('describeUses', () => {
	it('shows the limit when there is one', () => {
		expect(describeUses(2, 5)).toBe('2 of 5 used');
		expect(describeUses(3, null)).toBe('3 used');
	});
});
