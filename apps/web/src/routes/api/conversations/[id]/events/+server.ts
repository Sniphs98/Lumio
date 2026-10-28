import { error } from '@sveltejs/kit';
import { getConversation } from '#lib/server/conversations.ts';
import { eventStream } from '#lib/server/sse.ts';
import type { RequestHandler } from './$types';

/** Server-Sent Events stream of a direct or group conversation, for its members only. */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const conversation = await getConversation(params.id, locals.user.id);
	if (!conversation) error(404, 'Conversation not found');

	const userId = locals.user.id;
	return eventStream(conversation.id, request, {
		// Someone removed from a group stops getting its messages right away.
		until: (event) => event.type === 'member.removed' && event.userId === userId
	});
};
