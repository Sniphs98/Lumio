import { error } from '@sveltejs/kit';
import { userTopic } from '#lib/server/realtime.ts';
import { eventStream } from '#lib/server/sse.ts';
import type { RequestHandler } from './$types';

/** Server-Sent Events stream of the signed-in user, e.g. new friend requests. */
export const GET: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');
	return eventStream(userTopic(locals.user.id), request);
};
