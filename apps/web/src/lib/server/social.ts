import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import {
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	STEAM_API_KEY
} from '$app/env/private';
import {
	ADMISSION_COOKIE,
	ADMISSION_COOKIE_MAX_AGE,
	ADMISSION_COOKIE_PATH,
	encodeAdmission,
	parseAdmission
} from '#lib/server/admission-cookie.ts';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { account } from '#lib/server/db/schema.ts';
import type { Admission } from '#lib/server/invites.ts';
import { STEAM_CALLBACK_PATH } from '#lib/server/steam.ts';
import { STEAM_OPENID_ENDPOINT } from '#lib/server/steam-openid.ts';
import {
	PROVIDER_NAMES,
	SOCIAL_PROVIDERS,
	withProvider,
	type SocialProvider
} from '#lib/social.ts';

/**
 * Signing in with another service is optional: each Lumio turns a service on with its own
 * credentials, see "Sign in with Discord, Google or Steam" in the README.
 */
const configured: Record<SocialProvider, boolean> = {
	discord: Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
	google: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
	steam: Boolean(STEAM_API_KEY)
};

/** The services this Lumio offers, in the order their buttons are shown. */
export const enabledProviders: SocialProvider[] = SOCIAL_PROVIDERS.filter((p) => configured[p]);

/** The external sites sign-in may redirect to, per service. */
const ORIGINS: Record<SocialProvider, string> = {
	discord: 'https://discord.com',
	google: 'https://accounts.google.com',
	steam: new URL(STEAM_OPENID_ENDPOINT).origin
};

/** Where each service sends users back to, handled by Better Auth. */
export const CALLBACK_PATHS: readonly string[] = [
	'/api/auth/callback/discord',
	'/api/auth/callback/google',
	STEAM_CALLBACK_PATH
];

type SignInOptions = {
	/** Local path to open once signed in. */
	callbackURL: string;
	/** Local path to come back to on errors. Better Auth adds `?error=<code>`. */
	errorCallbackURL: string;
	/** The invite or friend link a new user joins through. */
	admission?: Admission;
};

/** Reads the service from a sign-in form: its button posts `provider`. */
export async function requestedProvider(event: RequestEvent): Promise<SocialProvider> {
	const value = (await event.request.formData()).get('provider');
	const provider = enabledProviders.find((p) => p === value);
	if (!provider) error(404, 'Signing in with this service is not set up on this Lumio.');
	return provider;
}

/**
 * Sends the user to the service to sign in. Members who connected that service are signed
 * in; anyone else gets a new account, which like every sign-up needs the first-user slot or
 * a valid link, see `admitNewUser`. Called from form actions, so it always redirects.
 */
export async function signInWith(
	event: RequestEvent,
	provider: SocialProvider,
	{ callbackURL, errorCallbackURL, admission }: SignInOptions
): Promise<never> {
	if (!configured[provider])
		error(404, `Signing in with ${PROVIDER_NAMES[provider]} is not set up.`);
	if (admission) {
		event.cookies.set(ADMISSION_COOKIE, encodeAdmission(admission), {
			path: ADMISSION_COOKIE_PATH,
			httpOnly: true,
			sameSite: 'lax',
			maxAge: ADMISSION_COOKIE_MAX_AGE
		});
	} else {
		event.cookies.delete(ADMISSION_COOKIE, { path: ADMISSION_COOKIE_PATH });
	}
	const body = { callbackURL, errorCallbackURL: withProvider(errorCallbackURL, provider) };
	const { url } =
		provider === 'steam'
			? await auth.api.signInSteam({ body, headers: event.request.headers })
			: await auth.api.signInSocial({
					body: { ...body, provider, disableRedirect: true },
					headers: event.request.headers
				});
	if (!url) error(500, `Could not reach ${PROVIDER_NAMES[provider]}.`);
	redirect(303, url, { external: [ORIGINS[provider]] });
}

/** Sends the signed-in member to the service to connect their account there. */
export async function connect(event: RequestEvent, provider: SocialProvider): Promise<never> {
	if (!configured[provider])
		error(404, `Signing in with ${PROVIDER_NAMES[provider]} is not set up.`);
	const body = { callbackURL: '/account', errorCallbackURL: withProvider('/account', provider) };
	const { url } =
		provider === 'steam'
			? await auth.api.linkSteam({ body, headers: event.request.headers })
			: await auth.api.linkSocialAccount({
					body: { ...body, provider, disableRedirect: true },
					headers: event.request.headers
				});
	redirect(303, url, { external: [ORIGINS[provider]] });
}

/**
 * Disconnects a service from a member. Refused while it is their only way to sign in, i.e.
 * when they have neither a password nor another connected service. Returns an error message,
 * or null on success.
 */
export async function disconnect(userId: string, provider: SocialProvider): Promise<string | null> {
	return db.transaction(async (tx) => {
		const [other] = await tx
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, userId), ne(account.providerId, provider)))
			.limit(1);
		if (!other) {
			return `${PROVIDER_NAMES[provider]} is your only way to sign in, so it stays connected.`;
		}
		await tx
			.delete(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, provider)));
		return null;
	});
}

/**
 * The link a sign-up through another service started from, read on the service's way back,
 * or undefined if there is none. The cookie is removed right away, see `clearAdmissionCookie`.
 */
export function readAdmission(event: RequestEvent): Admission | undefined {
	return parseAdmission(event.cookies.get(ADMISSION_COOKIE));
}

/**
 * The `Set-Cookie` header that removes the link cookie, so a later sign-in in this browser
 * cannot reuse it. Better Auth answers the service's way back with its own response, which
 * SvelteKit's `cookies` do not reach, so the header is added to that response directly.
 */
export function clearAdmissionCookie(event: RequestEvent): string {
	return event.cookies.serialize(ADMISSION_COOKIE, '', { path: ADMISSION_COOKIE_PATH, maxAge: 0 });
}
