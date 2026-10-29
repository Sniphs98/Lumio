import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '$app/env/private';
import {
	ADMISSION_COOKIE,
	ADMISSION_COOKIE_MAX_AGE,
	encodeAdmission,
	parseAdmission
} from '#lib/server/admission-cookie.ts';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { account } from '#lib/server/db/schema.ts';
import type { Admission } from '#lib/server/invites.ts';

/** Signing in with Discord is optional: each Lumio turns it on with its own Discord application. */
export const discordEnabled = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);

/** The only external site sign-in may redirect to. */
const DISCORD_ORIGIN = 'https://discord.com';

/** Where Discord sends users back to, handled by Better Auth. */
export const DISCORD_CALLBACK_PATH = '/api/auth/callback/discord';

type SignInOptions = {
	/** Local path to open once signed in. */
	callbackURL: string;
	/** Local path to come back to on errors. Better Auth adds `?error=<code>`. */
	errorCallbackURL: string;
	/** The invite or friend link a new user joins through. */
	admission?: Admission;
};

/**
 * Sends the user to Discord to sign in. Members whose Discord account is connected are signed
 * in; anyone else gets a new account, which like every sign-up needs the first-user slot or
 * a valid link, see `admitNewUser`. Called from form actions, so it always redirects.
 */
export async function signInWithDiscord(
	event: RequestEvent,
	{ callbackURL, errorCallbackURL, admission }: SignInOptions
): Promise<never> {
	if (!discordEnabled) error(404, 'Signing in with Discord is not set up on this Lumio.');
	if (admission) {
		event.cookies.set(ADMISSION_COOKIE, encodeAdmission(admission), {
			path: DISCORD_CALLBACK_PATH,
			httpOnly: true,
			sameSite: 'lax',
			maxAge: ADMISSION_COOKIE_MAX_AGE
		});
	} else {
		event.cookies.delete(ADMISSION_COOKIE, { path: DISCORD_CALLBACK_PATH });
	}
	const { url } = await auth.api.signInSocial({
		body: { provider: 'discord', callbackURL, errorCallbackURL, disableRedirect: true },
		headers: event.request.headers
	});
	if (!url) error(500, 'Could not reach Discord.');
	redirect(303, url, { external: [DISCORD_ORIGIN] });
}

/** Sends the signed-in member to Discord to connect their Discord account. */
export async function connectDiscord(event: RequestEvent): Promise<never> {
	if (!discordEnabled) error(404, 'Signing in with Discord is not set up on this Lumio.');
	const { url } = await auth.api.linkSocialAccount({
		body: {
			provider: 'discord',
			callbackURL: '/account',
			errorCallbackURL: '/account',
			disableRedirect: true
		},
		headers: event.request.headers
	});
	redirect(303, url, { external: [DISCORD_ORIGIN] });
}

/**
 * Disconnects Discord from a member. Refused while it is their only way to sign in, i.e.
 * when they have no password. Returns an error message, or null on success.
 */
export async function disconnectDiscord(userId: string): Promise<string | null> {
	return db.transaction(async (tx) => {
		const [password] = await tx
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
		if (!password) return 'Discord is your only way to sign in, so it stays connected.';
		await tx
			.delete(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')));
		return null;
	});
}

/**
 * The link a sign-up through Discord started from, read on Discord's way back, or undefined
 * if there is none. The cookie is removed right away, see `clearAdmissionCookie`.
 */
export function readAdmission(event: RequestEvent): Admission | undefined {
	return parseAdmission(event.cookies.get(ADMISSION_COOKIE));
}

/**
 * The `Set-Cookie` header that removes the link cookie, so a later sign-in in this browser
 * cannot reuse it. Better Auth answers Discord's way back with its own response, which
 * SvelteKit's `cookies` do not reach, so the header is added to that response directly.
 */
export function clearAdmissionCookie(event: RequestEvent): string {
	return event.cookies.serialize(ADMISSION_COOKIE, '', { path: DISCORD_CALLBACK_PATH, maxAge: 0 });
}
