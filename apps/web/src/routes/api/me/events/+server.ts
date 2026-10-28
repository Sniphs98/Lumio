import { error } from '@sveltejs/kit';
import { hasChat } from '#lib/channels.ts';
import { listVisibleChannelIds } from '#lib/server/channels.ts';
import { userTopic } from '#lib/server/realtime.ts';
import { eventStream } from '#lib/server/sse.ts';
import { CHANNEL_ACTIVITY_TOPIC } from '#lib/server/unread.ts';
import type { RequestHandler } from './$types';

/**
 * Server-Sent Events stream of the signed-in user, e.g. new friend requests, plus a
 * `message.activity` event whenever someone writes in a channel they can see, to update
 * unread counts.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	// Permission changes take effect when the client reconnects.
	const visible = await listVisibleChannelIds(locals.user.id, hasChat);
	return eventStream([userTopic(locals.user.id), CHANNEL_ACTIVITY_TOPIC], request, {
		filter: (event) =>
			event.type !== 'message.activity' || event.channelId === null || visible.has(event.channelId)
	});
};
