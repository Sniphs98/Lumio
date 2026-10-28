import { fail, redirect } from '@sveltejs/kit';
import { parseGuestName } from '#lib/guests.ts';
import { signInAsGuest, signUpWithAccount } from '#lib/server/guests.ts';
import { getInstance } from '#lib/server/instance.ts';
import { getValidInvite } from '#lib/server/invites.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// One instance is one community, so a signed-in user is already a member.
	if (locals.user) redirect(302, '/channels');

	const [inst, invite] = await Promise.all([getInstance(), getValidInvite(params.code)]);
	return {
		instanceName: inst?.name ?? 'Lumio',
		invite: invite ? { inviterName: invite.createdByName, allowGuests: invite.allowGuests } : null
	};
};

export const actions: Actions = {
	guest: async (event) => {
		const name = parseGuestName((await event.request.formData()).get('name'));
		if (!name.ok) return fail(400, { message: name.error });

		const result = await signInAsGuest(event, name.name, {
			kind: 'invite',
			code: event.params.code
		});
		if (!result.ok) return fail(400, { message: result.error });
		// The browser keeps the guest, then continues to the server.
		return { guest: result.guest, redirectTo: '/channels' };
	},
	account: async (event) => {
		const formData = await event.request.formData();
		const details = {
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? '',
			name: formData.get('name')?.toString() ?? ''
		};
		const result = await signUpWithAccount(event, details, {
			kind: 'invite',
			code: event.params.code
		});
		if (!result.ok) return fail(400, { message: result.error });
		redirect(302, '/channels');
	}
};
