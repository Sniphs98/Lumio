/** Shared invite link rules, used on the server and in the browser. */

/** How long a new invite link stays valid. `null` means it never expires. */
export const EXPIRY_OPTIONS = [
	{ value: '1800', label: '30 minutes', seconds: 30 * 60 },
	{ value: '3600', label: '1 hour', seconds: 60 * 60 },
	{ value: '21600', label: '6 hours', seconds: 6 * 60 * 60 },
	{ value: '86400', label: '1 day', seconds: 24 * 60 * 60 },
	{ value: '604800', label: '7 days', seconds: 7 * 24 * 60 * 60 },
	{ value: 'never', label: 'Never', seconds: null }
] as const;

/** How many people can join with a new invite link. `null` means no limit. */
export const MAX_USES_OPTIONS = [
	{ value: 'none', label: 'No limit', uses: null },
	{ value: '1', label: '1 use', uses: 1 },
	{ value: '5', label: '5 uses', uses: 5 },
	{ value: '10', label: '10 uses', uses: 10 },
	{ value: '25', label: '25 uses', uses: 25 },
	{ value: '100', label: '100 uses', uses: 100 }
] as const;

export const DEFAULT_EXPIRY = '604800';
export const DEFAULT_MAX_USES = 'none';

export type InviteSettings = {
	/** Seconds until the link expires, or `null` if it never does. */
	expiresInSeconds: number | null;
	maxUses: number | null;
};

/** Reads the settings of the "create invite" form. Only the listed options are accepted. */
export function parseInviteSettings(
	expiry: unknown,
	maxUses: unknown
): { ok: true; settings: InviteSettings } | { ok: false; error: string } {
	const e = EXPIRY_OPTIONS.find((o) => o.value === expiry);
	const m = MAX_USES_OPTIONS.find((o) => o.value === maxUses);
	if (!e || !m) return { ok: false, error: 'Pick an expiry and a maximum number of uses.' };
	return { ok: true, settings: { expiresInSeconds: e.seconds, maxUses: m.uses } };
}

export type InviteLimits = {
	uses: number;
	maxUses: number | null;
	expiresAt: Date | null;
};

export type InviteState = 'valid' | 'expired' | 'used-up';

export function inviteState(invite: InviteLimits, now = new Date()): InviteState {
	if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return 'expired';
	if (invite.maxUses !== null && invite.uses >= invite.maxUses) return 'used-up';
	return 'valid';
}

/** A short human description such as "Expires in 3 days" or "Never expires". */
export function describeExpiry(expiresAt: Date | null, now = new Date()): string {
	if (!expiresAt) return 'Never expires';
	const seconds = Math.round((expiresAt.getTime() - now.getTime()) / 1000);
	if (seconds <= 0) return 'Expired';
	const format = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		['day', 24 * 60 * 60],
		['hour', 60 * 60],
		['minute', 60]
	];
	for (const [unit, size] of units) {
		if (seconds >= size) return `Expires ${format.format(Math.floor(seconds / size), unit)}`;
	}
	return `Expires ${format.format(1, 'minute')}`;
}

export function describeUses(uses: number, maxUses: number | null): string {
	return maxUses === null ? `${uses} used` : `${uses} of ${maxUses} used`;
}
