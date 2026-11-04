/** Signing in with another service (Discord, Google, Steam), shared by the server and the browser. */

/** Every service people can sign in with, in the order their buttons are shown. */
export const SOCIAL_PROVIDERS = ['discord', 'google', 'steam'] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const PROVIDER_NAMES: Record<SocialProvider, string> = {
	discord: 'Discord',
	google: 'Google',
	steam: 'Steam'
};

export function isSocialProvider(value: unknown): value is SocialProvider {
	return (SOCIAL_PROVIDERS as readonly unknown[]).includes(value);
}

/** The services' names as a list for a sentence, e.g. `Discord, Google or Steam`. */
export function providerList(providers: readonly SocialProvider[]): string {
	const names = providers.map((p) => PROVIDER_NAMES[p]);
	return names.length < 2
		? (names[0] ?? '')
		: `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

/**
 * Query parameter that names the service on the way back, next to the `?error=` code Better
 * Auth adds, so an error message can say which service failed.
 */
export const PROVIDER_PARAM = 'via';

/** Error codes our Better Auth hooks attach, so a failed sign-in with another service can say why. */
export const SOCIAL_ERRORS = {
	notAdmitted: 'not_admitted',
	banned: 'banned',
	invalidName: 'invalid_name'
} as const;

const MESSAGES: Record<string, (name: string) => string> = {
	[SOCIAL_ERRORS.notAdmitted]: (name) =>
		`You need a valid invite link to join this Lumio. Open the link you got and continue with ${name} there.`,
	[SOCIAL_ERRORS.banned]: () => 'You are banned from this Lumio.',
	[SOCIAL_ERRORS.invalidName]: (name) => `Your name on ${name} cannot be used here.`,
	account_not_linked: (name) =>
		`An account with this email already exists. Sign in with your password, then connect ${name} on your account page.`,
	email_not_found: (name) =>
		`Your account on ${name} has no email address. Add one there, then try again.`,
	account_already_linked_to_different_user: (name) =>
		`That account on ${name} is already connected to another Lumio account.`,
	access_denied: (name) => `You cancelled signing in with ${name}.`
};

/**
 * The message for the `?error=` code Better Auth adds when signing in or connecting with
 * another service fails, or null without one. Only known codes get their own text: the query
 * is part of a link anyone can send, so it never puts arbitrary text on the page. The service
 * comes from `?via=` and falls back to a neutral name for anything unknown.
 */
export function socialErrorMessage(code: string | null, provider: string | null): string | null {
	if (!code) return null;
	const name = isSocialProvider(provider) ? PROVIDER_NAMES[provider] : 'the other service';
	return (
		MESSAGES[code]?.(name) ??
		(isSocialProvider(provider)
			? `Signing in with ${name} did not work. Please try again.`
			: 'Signing in did not work. Please try again.')
	);
}

/** The error message for a page, read from its `?error=` and `?via=` parameters. */
export function socialErrorFromUrl(url: URL): string | null {
	return socialErrorMessage(url.searchParams.get('error'), url.searchParams.get(PROVIDER_PARAM));
}

/**
 * Adds `?via=<provider>` to a local path, the page Better Auth sends people back to on errors.
 */
export function withProvider(path: string, provider: SocialProvider): string {
	return `${path}${path.includes('?') ? '&' : '?'}${PROVIDER_PARAM}=${provider}`;
}
