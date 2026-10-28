import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';
import { setUpInstanceIfNeeded } from '#lib/server/instance.ts';
import { admitNewUser } from '#lib/server/invites.ts';

/** Invite code of the current sign-up, set by the invite page before it calls Better Auth. */
function currentInviteCode(): string | undefined {
	try {
		return getRequestEvent().locals.inviteCode;
	} catch {
		return undefined;
	}
}

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	databaseHooks: {
		user: {
			create: {
				// After the first user, accounts can only be created through an invite link.
				// This also covers direct calls to the sign-up API, which never carry an invite.
				before: async () => {
					const error = await admitNewUser(currentInviteCode());
					if (error) throw new APIError('FORBIDDEN', { message: error });
				},
				// The first user to sign up becomes the owner of this instance.
				after: (user) => setUpInstanceIfNeeded(user.id, user.name)
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
