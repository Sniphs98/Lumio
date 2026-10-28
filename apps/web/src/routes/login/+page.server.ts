import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import { restoreGuestSession } from '#lib/server/guests.ts';
import { getInstance } from '#lib/server/instance.ts';
import type { Actions, PageServerLoad } from './$types';

/** Where to go after signing in: a local path from `?redirectTo=`, or Home. */
function target(url: URL): string {
	const to = url.searchParams.get('redirectTo');
	return to?.startsWith('/') && !to.startsWith('//') && !to.startsWith('/\\') ? to : '/';
}

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) redirect(302, target(event.url));
	// Only the first user can register here and becomes the owner; everyone else needs an invite link.
	return { registrationOpen: !(await getInstance()) };
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

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
	/** Signs a guest back in with the session their browser kept in `localStorage`. */
	continueAsGuest: async (event) => {
		const token = (await event.request.formData()).get('token');
		if (typeof token !== 'string' || !(await restoreGuestSession(event, token))) {
			return fail(400, { guestExpired: true });
		}
		redirect(302, target(event.url));
	}
};
