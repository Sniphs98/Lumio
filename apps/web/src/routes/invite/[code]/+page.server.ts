import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import { getInstance } from '#lib/server/instance.ts';
import { getValidInvite } from '#lib/server/invites.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// One instance is one community, so a signed-in user is already a member.
	if (locals.user) redirect(302, '/channels');

	const [inst, invite] = await Promise.all([getInstance(), getValidInvite(params.code)]);
	return {
		instanceName: inst?.name ?? 'Lumio',
		invite: invite ? { inviterName: invite.createdByName } : null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		// Read by the Better Auth user hook, which uses up one join of the invite.
		event.locals.inviteCode = event.params.code;
		try {
			await auth.api.signUpEmail({ body: { email, password, name } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		redirect(302, '/channels');
	}
};
