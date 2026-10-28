import { error, fail, redirect } from '@sveltejs/kit';
import { normalizeContent } from '#lib/chat.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import { createMessage, listMessages } from '#lib/server/messages.ts';
import { publish } from '#lib/server/realtime.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadChannel(userId: string, channelId: string) {
	const channel = await getChannel(channelId).catch(() => null);
	if (!channel || channel.type === 'category') error(404, 'Channel not found');

	const permissions = await getChannelPermissions(userId, channel.id);
	if (!hasPermission(permissions, Permission.ViewChannel)) error(404, 'Channel not found');

	return { channel, permissions };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	// Server loads run in parallel with the layout's auth check, so check again here.
	if (!locals.user) redirect(302, '/login');
	const { channel, permissions } = await loadChannel(locals.user.id, params.id);

	if (channel.type === 'voice') {
		return {
			kind: 'voice' as const,
			channel: { id: channel.id, name: channel.name, topic: channel.topic },
			canConnect: hasPermission(permissions, Permission.Connect)
		};
	}
	return {
		kind: 'text' as const,
		channel: { id: channel.id, name: channel.name, topic: channel.topic },
		messages: await listMessages({ channelId: channel.id }),
		canSend: hasPermission(permissions, Permission.SendMessages)
	};
};

export const actions: Actions = {
	send: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { channel, permissions } = await loadChannel(locals.user.id, params.id);
		if (channel.type !== 'text') error(404, 'Channel not found');
		if (!hasPermission(permissions, Permission.SendMessages)) {
			return fail(403, { error: 'You cannot send messages in this channel.' });
		}

		const form = await request.formData();
		const result = normalizeContent(form.get('content'));
		if (!result.ok) return fail(400, { error: result.error });

		const message = await createMessage({ channelId: channel.id }, locals.user.id, result.content);
		publish(channel.id, { type: 'message.created', message });
		return { message };
	}
};
