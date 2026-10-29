import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Signing out is a form action, so other sites cannot sign people out with a link.
export const load: PageServerLoad = () => redirect(302, '/');

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (locals.session) await auth.api.signOut({ headers: request.headers });
		redirect(303, '/login');
	}
};
