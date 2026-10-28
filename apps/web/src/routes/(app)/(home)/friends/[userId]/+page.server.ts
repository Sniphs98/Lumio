import { error, redirect } from '@sveltejs/kit';
import { getOrCreateDirectConversation } from '#lib/server/conversations.ts';
import { areFriends } from '#lib/server/friends.ts';
import type { PageServerLoad } from './$types';

/** Opens the direct conversation with a friend, creating it on first use. */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');
	if (!(await areFriends(locals.user.id, params.userId))) error(404, 'Friend not found');

	const id = await getOrCreateDirectConversation(locals.user.id, params.userId);
	redirect(303, `/dm/${id}`);
};
