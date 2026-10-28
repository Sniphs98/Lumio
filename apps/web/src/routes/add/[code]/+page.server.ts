import { error, fail, redirect } from '@sveltejs/kit';
import { parseGuestName } from '#lib/guests.ts';
import { friendLinkAdmitsNewUsers, getFriendLinkOwner } from '#lib/server/friend-links.ts';
import { areFriends, befriendThroughLink } from '#lib/server/friends.ts';
import { signInAsGuest, signUpWithAccount } from '#lib/server/guests.ts';
import { getInstance } from '#lib/server/instance.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** A personal friend link: members become friends with its owner, newcomers join first. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const [inst, owner] = await Promise.all([getInstance(), getFriendLinkOwner(params.code)]);
	const instanceName = inst?.name ?? 'Lumio';
	if (!owner) return { instanceName, owner: null, state: 'invalid' as const };

	if (locals.user) {
		if (owner.id === locals.user.id) return { instanceName, owner, state: 'own' as const };
		if (await areFriends(locals.user.id, owner.id)) redirect(302, `/friends/${owner.id}`);
		return { instanceName, owner, state: 'member' as const };
	}
	return {
		instanceName,
		owner,
		state: (await friendLinkAdmitsNewUsers(owner.id)) ? ('newcomer' as const) : ('sign-in' as const)
	};
};

async function linkOwner(code: string) {
	const owner = await getFriendLinkOwner(code);
	if (!owner) error(404, 'This friend link is invalid or was reset.');
	return owner;
}

/** Makes the new or signed-in user friends with the link's owner. */
async function befriend(event: RequestEvent, userId: string, ownerId: string) {
	const result = await befriendThroughLink(userId, ownerId);
	return result.ok ? null : fail(400, { message: result.error });
}

export const actions: Actions = {
	befriend: async (event) => {
		if (!event.locals.user) redirect(302, `/login?redirectTo=/add/${event.params.code}`);
		const owner = await linkOwner(event.params.code);
		const failure = await befriend(event, event.locals.user.id, owner.id);
		if (failure) return failure;
		redirect(303, `/friends/${owner.id}`);
	},
	guest: async (event) => {
		const owner = await linkOwner(event.params.code);
		const name = parseGuestName((await event.request.formData()).get('name'));
		if (!name.ok) return fail(400, { message: name.error });

		const result = await signInAsGuest(event, name.name, {
			kind: 'friend',
			code: event.params.code
		});
		if (!result.ok) return fail(400, { message: result.error });
		const failure = await befriend(event, result.guest.userId, owner.id);
		if (failure) return failure;
		// The browser keeps the guest, then opens the chat with the new friend.
		return { guest: result.guest, redirectTo: `/friends/${owner.id}` };
	},
	account: async (event) => {
		const owner = await linkOwner(event.params.code);
		const formData = await event.request.formData();
		const details = {
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? '',
			name: formData.get('name')?.toString() ?? ''
		};
		const result = await signUpWithAccount(event, details, {
			kind: 'friend',
			code: event.params.code
		});
		if (!result.ok) return fail(400, { message: result.error });
		const failure = await befriend(event, result.userId, owner.id);
		if (failure) return failure;
		redirect(302, `/friends/${owner.id}`);
	}
};
