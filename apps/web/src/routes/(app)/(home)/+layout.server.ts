import { redirect } from '@sveltejs/kit';
import { listDirectConversationIds, listGroupConversations } from '#lib/server/conversations.ts';
import { getFriendLists } from '#lib/server/friends.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	if (!locals.user) redirect(302, '/login');
	// Invalidated by the Home tab when the user's event stream says something changed.
	depends('app:home');

	const [friendLists, directConversationIds, groups] = await Promise.all([
		getFriendLists(locals.user.id),
		listDirectConversationIds(locals.user.id),
		listGroupConversations(locals.user.id)
	]);
	return { ...friendLists, directConversationIds, groups };
};
