import { error } from '@sveltejs/kit';
import { isJoinable } from '#lib/channels.ts';
import { listVisibleChannelIds } from '#lib/server/channels.ts';
import { eventStream } from '#lib/server/sse.ts';
import { getVoiceState, VOICE_TOPIC, watchVoiceState } from '#lib/server/voice.ts';
import { visibleVoiceState } from '#lib/server/voice-state.ts';
import type { RequestHandler } from './$types';

/**
 * Server-Sent Events stream of who is in which voice channel, so everyone sees it
 * without joining. Starts with the whole state, then sends changes.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	// Permission changes take effect when the client reconnects.
	const visible = await listVisibleChannelIds(locals.user.id, isJoinable);
	return eventStream(VOICE_TOPIC, request, {
		initial: async () => [
			{ type: 'voice.state', channels: visibleVoiceState(await getVoiceState(), visible) }
		],
		filter: (event) => event.type !== 'voice.changed' || visible.has(event.channelId),
		onClose: watchVoiceState()
	});
};
