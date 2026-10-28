import { error, fail } from '@sveltejs/kit';
import { normalizeFriendEmail } from '#lib/friends.ts';
import { acceptFriendRequest, removeFriendship, sendFriendRequest } from '#lib/server/friends.ts';
import type { Actions } from './$types';

// The friend list lives in the Home layout, so its forms post here from every Home page.
export const actions: Actions = {
	addFriend: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const email = normalizeFriendEmail(form.get('email'));
		if (!email.ok) return fail(400, { friendError: email.error });

		const result = await sendFriendRequest(locals.user.id, email.email);
		if (!result.ok) return fail(400, { friendError: result.error });
		return {
			friendNotice: result.accepted
				? `You and ${result.friend.name} are now friends.`
				: `Friend request sent to ${result.friend.name}.`
		};
	},
	accept: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const userId = (await request.formData()).get('userId');
		if (typeof userId !== 'string' || !(await acceptFriendRequest(locals.user.id, userId))) {
			return fail(404, { friendError: 'This friend request no longer exists.' });
		}
		return {};
	},
	remove: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const userId = (await request.formData()).get('userId');
		if (typeof userId === 'string') await removeFriendship(locals.user.id, userId);
		return {};
	}
};
