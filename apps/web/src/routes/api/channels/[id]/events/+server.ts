import { error } from '@sveltejs/kit';
import { hasChat } from '#lib/channels.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import { eventStream } from '#lib/server/sse.ts';
import type { RequestHandler } from './$types';

/** Server-Sent Events stream of a channel. */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const channel = await getChannel(params.id).catch(() => null);
	if (!channel || !hasChat(channel.type)) error(404, 'Channel not found');
	const permissions = await getChannelPermissions(locals.user.id, channel.id);
	if (!hasPermission(permissions, Permission.ViewChannel)) error(404, 'Channel not found');

	return eventStream(channel.id, request, { revokedFor: locals.user.id });
};
