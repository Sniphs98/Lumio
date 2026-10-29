import { describe, expect, it } from 'vitest';
import { DISCORD_ERRORS, discordErrorMessage } from './discord.ts';

describe('discordErrorMessage', () => {
	it('has no message without an error', () => {
		expect(discordErrorMessage(null)).toBeNull();
		expect(discordErrorMessage('')).toBeNull();
	});

	it('explains known errors', () => {
		expect(discordErrorMessage(DISCORD_ERRORS.notAdmitted)).toMatch(/invite link/);
		expect(discordErrorMessage(DISCORD_ERRORS.banned)).toBe('You are banned from this Lumio.');
		expect(discordErrorMessage('account_not_linked')).toMatch(/connect Discord/);
	});

	it('never shows text from the link for unknown errors', () => {
		const message = discordErrorMessage('Your account is locked, call 555-0100');
		expect(message).toBe('Signing in with Discord did not work. Please try again.');
	});
});
