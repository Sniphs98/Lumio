import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	STEAM_API_KEY
} from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { anonymous } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { parseGuestName } from '#lib/guests.ts';
import { db } from '#lib/server/db/index.ts';
import { setUpInstanceIfNeeded } from '#lib/server/instance.ts';
import { admitNewUser } from '#lib/server/invites.ts';
import { isBanned } from '#lib/server/moderation.ts';
import { steam } from '#lib/server/steam.ts';
import { SOCIAL_ERRORS } from '#lib/social.ts';

/**
 * Display names follow the same rules everywhere (trimmed, at most 32 characters), also when
 * set through the Better Auth HTTP API, e.g. `/api/auth/update-user`, or taken from Discord,
 * Google or Steam.
 * Throws for invalid names.
 */
function checkedName(name: unknown): string {
	const parsed = parseGuestName(name);
	if (!parsed.ok) {
		throw new APIError('BAD_REQUEST', { message: parsed.error, code: SOCIAL_ERRORS.invalidName });
	}
	return parsed.name;
}

/** Reads `locals` of the current request, if Better Auth was called from one. */
function currentLocals(): App.Locals | undefined {
	try {
		return getRequestEvent().locals;
	} catch {
		return undefined;
	}
}

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	// All optional, see "Sign in with Discord, Google or Steam" in the README. Steam is a plugin
	// below, since it uses OpenID 2.0 instead of OAuth.
	socialProviders: {
		...(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET
			? { discord: { clientId: DISCORD_CLIENT_ID, clientSecret: DISCORD_CLIENT_SECRET } }
			: {}),
		...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
			? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
			: {})
	},
	account: {
		accountLinking: {
			// Other services are only connected to an existing account from its account page, never
			// because the email addresses match: Lumio does not verify email addresses.
			disableImplicitLinking: true,
			// Many people use a different email address on Discord or Google.
			allowDifferentEmails: true,
			// Steam shares no email address, so Better Auth cannot see a verified one. Connecting
			// it is still safe: only the signed-in member can, from their account page.
			trustedProviders: ['steam']
		}
	},
	session: {
		// Guests have no password: losing their session means losing their account. Sessions
		// stay valid for 30 days and are extended on every visit, for members and guests alike.
		expiresIn: 30 * 24 * 60 * 60
	},
	databaseHooks: {
		user: {
			create: {
				// After the first user, accounts and guests can only be created through an invite
				// or friend link. This also covers direct calls to the sign-up API, which never carry one.
				before: async (user) => {
					const asGuest = (user as { isAnonymous?: boolean }).isAnonymous === true;
					const name = checkedName(user.name);
					const error = await admitNewUser(currentLocals()?.admission, asGuest);
					// The code lets a failed sign-up through another service show why, see `#lib/social.ts`.
					if (error) {
						throw new APIError('FORBIDDEN', { message: error, code: SOCIAL_ERRORS.notAdmitted });
					}
					// Profile pictures are uploaded to Lumio from the account page. An image URL from the
					// sign-up request (or Discord or Google) would load from another server for everyone who sees
					// the user, revealing their IP addresses.
					return { data: { ...user, name, image: null } };
				},
				// The first user to sign up becomes the owner of this instance.
				after: (user) => setUpInstanceIfNeeded(user.id, user.name)
			},
			update: {
				before: async (user) => {
					// Same here: profile pictures are only set by uploading one, see `#lib/server/images.ts`,
					// which updates the database directly.
					if (user.image != null) {
						throw new APIError('BAD_REQUEST', {
							message: 'Upload a profile picture on the account page instead.'
						});
					}
					return 'name' in user ? { data: { ...user, name: checkedName(user.name) } } : undefined;
				}
			}
		},
		session: {
			create: {
				// Banned users cannot sign in, see `#lib/server/moderation.ts`.
				before: async (session) => {
					if (await isBanned(session.userId)) {
						throw new APIError('FORBIDDEN', {
							message: 'You are banned from this Lumio.',
							code: SOCIAL_ERRORS.banned
						});
					}
				}
			}
		}
	},
	plugins: [
		// Guests join with only a name. They become full members later without changing their
		// user id, see `#lib/server/guests.ts`, so the plugin's account linking is never used.
		anonymous({
			generateName: () => currentLocals()?.guestName ?? 'Guest',
			disableDeleteAnonymousUser: true
		}),
		// Off without an API key: its endpoints then refuse, and no button is shown.
		steam({ apiKey: STEAM_API_KEY }),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
