import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
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

/**
 * Display names follow the same rules everywhere (trimmed, at most 32 characters), also when
 * set through the Better Auth HTTP API, e.g. `/api/auth/update-user`. Throws for invalid names.
 */
function checkedName(name: unknown): string {
	const parsed = parseGuestName(name);
	if (!parsed.ok) throw new APIError('BAD_REQUEST', { message: parsed.error });
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
					if (error) throw new APIError('FORBIDDEN', { message: error });
					// Lumio has no profile pictures yet. An image URL from the sign-up request would
					// load from any server for everyone who sees the user, revealing their IP addresses.
					return { data: { ...user, name, image: null } };
				},
				// The first user to sign up becomes the owner of this instance.
				after: (user) => setUpInstanceIfNeeded(user.id, user.name)
			},
			update: {
				before: async (user) => {
					if (user.image != null) {
						throw new APIError('BAD_REQUEST', { message: 'Profile pictures are not supported.' });
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
						throw new APIError('FORBIDDEN', { message: 'You are banned from this Lumio.' });
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
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
