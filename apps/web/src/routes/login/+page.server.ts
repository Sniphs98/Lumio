import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { discordErrorMessage } from '#lib/discord.ts';
import { auth } from '#lib/server/auth.ts';
import { discordEnabled, signInWithDiscord } from '#lib/server/discord.ts';
import { restoreGuestSession } from '#lib/server/guests.ts';
import { getInstance } from '#lib/server/instance.ts';
import {
	GUEST_RESTORE_PER_IP,
	rateLimit,
	SIGN_IN_PER_EMAIL,
	SIGN_IN_PER_IP,
	SIGN_UP_PER_IP,
	tooManyAttempts
} from '#lib/server/rate-limit.ts';
import { localRedirectTarget } from '#lib/redirect.ts';
import type { Actions, PageServerLoad } from './$types';

/** Where to go after signing in: a local path from `?redirectTo=`, or Home. */
function target(url: URL): string {
	return localRedirectTarget(url.searchParams.get('redirectTo'), url.origin);
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) redirect(302, target(event.url));
	// Only the first user can register here and becomes the owner; everyone else needs an invite link.
	return {
		registrationOpen: !(await getInstance()),
		discord: discordEnabled,
		discordError: discordErrorMessage(event.url.searchParams.get('error'))
	};
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		const limited = rateLimit(
			[`sign-in:ip:${event.getClientAddress()}`, SIGN_IN_PER_IP],
			[`sign-in:email:${email.trim().toLowerCase()}`, SIGN_IN_PER_EMAIL]
		);
		if (!limited.ok) return fail(429, { message: tooManyAttempts(limited) });

		try {
			await auth.api.signInEmail({ body: { email, password } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Sign in failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		redirect(302, target(event.url));
	},
	signUp: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		const limited = rateLimit([`sign-up:ip:${event.getClientAddress()}`, SIGN_UP_PER_IP]);
		if (!limited.ok) return fail(429, { message: tooManyAttempts(limited) });

		try {
			await auth.api.signUpEmail({ body: { email, password, name } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		redirect(302, '/');
	},
	/**
	 * Signs in with Discord. Without an invite link this only works for members whose Discord
	 * account is connected, and for the first user, who sets up this Lumio.
	 */
	discord: (event) => {
		const redirectTo = event.url.searchParams.get('redirectTo');
		return signInWithDiscord(event, {
			callbackURL: target(event.url),
			errorCallbackURL: redirectTo
				? `/login?redirectTo=${encodeURIComponent(target(event.url))}`
				: '/login'
		});
	},
	/** Signs a guest back in with the session their browser kept in `localStorage`. */
	continueAsGuest: async (event) => {
		const limited = rateLimit([
			`guest-restore:ip:${event.getClientAddress()}`,
			GUEST_RESTORE_PER_IP
		]);
		if (!limited.ok) return fail(429, { message: tooManyAttempts(limited) });

		const token = (await event.request.formData()).get('token');
		if (typeof token !== 'string' || !(await restoreGuestSession(event, token))) {
			return fail(400, { guestExpired: true });
		}
		redirect(302, target(event.url));
	}
};
