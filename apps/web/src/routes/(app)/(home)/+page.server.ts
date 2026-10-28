import { error, fail } from '@sveltejs/kit';
import { resetFriendLink } from '#lib/server/friend-links.ts';
import { acceptFriendRequest, removeFriendship } from '#lib/server/friends.ts';
import type { Actions } from './$types';

// The friend list lives in the Home layout, so its forms post here from every Home page.
export const actions: Actions = {
	resetFriendLink: async ({ locals }) => {
		if (!locals.user) error(401, 'Not signed in');
		await resetFriendLink(locals.user.id);
		return { friendNotice: 'New friend link created. The old one no longer works.' };
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
