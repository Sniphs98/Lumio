import { error, json } from '@sveltejs/kit';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from '$app/env/private';
import { parseRoomName, roomName, type CallRingingEvent, type CallSource } from '#lib/calls.ts';
import { groupTitle } from '#lib/groups.ts';
import { getCallAccess } from '#lib/server/calls.ts';
import { publish, userTopic } from '#lib/server/realtime.ts';
import type { RequestHandler } from './$types';

const TRACK_SOURCE: Record<CallSource, TrackSource> = {
	microphone: TrackSource.MICROPHONE,
	camera: TrackSource.CAMERA,
	screen_share: TrackSource.SCREEN_SHARE,
	screen_share_audio: TrackSource.SCREEN_SHARE_AUDIO
};

/**
 * Issues a short-lived LiveKit token for a voice channel (`channel:<id>`) or the call of a
 * conversation (`conversation:<id>`). Clients then connect to LiveKit directly; media never
 * passes through this app. Joining a conversation call rings its other members.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const body = (await request.json().catch(() => null)) as { room?: unknown } | null;
	const target = parseRoomName(body?.room);
	if (!target) error(400, 'Unknown room');

	const access = await getCallAccess(locals.user.id, target);
	if (!access) error(404, 'Call not found');

	const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
		identity: locals.user.id,
		name: locals.user.name,
		ttl: '10m'
	});
	token.addGrant({
		room: roomName(target.kind, target.id),
		roomJoin: true,
		canSubscribe: true,
		canPublish: access.sources.length > 0,
		canPublishSources: access.sources.map((s) => TRACK_SOURCE[s])
	});

	const conversation = access.conversation;
	if (conversation) {
		const caller = { id: locals.user.id, name: locals.user.name };
		for (const member of conversation.others) {
			// The conversation's title as this member sees it.
			const others = [caller, ...conversation.others.filter((o) => o.id !== member.id)];
			const title =
				conversation.type === 'group' ? groupTitle(conversation.name, others) : caller.name;
			const event: CallRingingEvent = {
				type: 'call.ringing',
				conversationId: conversation.id,
				title,
				caller
			};
			publish(userTopic(member.id), event);
		}
	}

	return json({ url: LIVEKIT_URL, token: await token.toJwt(), sources: access.sources });
};
