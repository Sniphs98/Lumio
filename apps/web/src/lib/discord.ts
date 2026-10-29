/** Signing in with Discord, shared by the server and the browser. */

/** Error codes our Better Auth hooks attach, so a failed Discord sign-in can say why. */
export const DISCORD_ERRORS = {
	notAdmitted: 'not_admitted',
	banned: 'banned',
	invalidName: 'invalid_name'
} as const;

const MESSAGES: Record<string, string> = {
	[DISCORD_ERRORS.notAdmitted]:
		'You need a valid invite link to join this Lumio. Open the link you got and continue with Discord there.',
	[DISCORD_ERRORS.banned]: 'You are banned from this Lumio.',
	[DISCORD_ERRORS.invalidName]: 'Your Discord name cannot be used here.',
	account_not_linked:
		'An account with this email already exists. Sign in with your password, then connect Discord on your account page.',
	email_not_found: 'Your Discord account has no email address. Add one in Discord, then try again.',
	account_already_linked_to_different_user:
		'This Discord account is already connected to another Lumio account.',
	access_denied: 'You cancelled signing in with Discord.'
};

/**
 * The message for the `?error=` code Better Auth adds when signing in or connecting with
 * Discord fails, or null without one. Only known codes get their own text: the query is
 * part of a link anyone can send, so it never puts arbitrary text on the page.
 */
export function discordErrorMessage(code: string | null): string | null {
	if (!code) return null;
	return MESSAGES[code] ?? 'Signing in with Discord did not work. Please try again.';
}
