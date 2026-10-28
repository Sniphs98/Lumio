import { error, json } from '@sveltejs/kit';
import { AccessToken } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

/**
 * Issues a short-lived LiveKit token for a voice channel or call.
 * Clients then connect to LiveKit directly; media never passes through this app.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const { room } = (await request.json()) as { room?: string };
	if (!room) error(400, 'Missing room');

	// TODO: check that the user may join this voice channel or conversation (Permission.Connect).

	const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
		identity: locals.user.id,
		name: locals.user.name,
		ttl: '10m'
	});
	token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

	return json({ url: LIVEKIT_URL, token: await token.toJwt() });
};
