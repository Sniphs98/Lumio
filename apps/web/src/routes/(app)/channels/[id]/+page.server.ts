import { error, fail, redirect } from '@sveltejs/kit';
import { parseAttachmentIds } from '#lib/attachments.ts';
import { hasChat, isJoinable } from '#lib/channels.ts';
import { normalizeContent, parseReplyTo } from '#lib/chat.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getMaxUploadSize } from '#lib/server/attachments.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import {
	createMessage,
	listMentionable,
	listMessages,
	markRead,
	rejection,
	toggleReaction
} from '#lib/server/messages.ts';
import { publish } from '#lib/server/realtime.ts';
import { notifyActivity } from '#lib/server/unread.ts';
import { parseEmoji } from '#lib/reactions.ts';
import type { Actions, PageServerLoad } from './$types';

/** A text or voice channel the user may see. Both have the same chat. */
async function loadChannel(userId: string, channelId: string) {
	const channel = await getChannel(channelId).catch(() => null);
	if (!channel || !hasChat(channel.type)) error(404, 'Channel not found');

	const permissions = await getChannelPermissions(userId, channel.id);
	if (!hasPermission(permissions, Permission.ViewChannel)) error(404, 'Channel not found');

	return { channel, permissions };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	// Server loads run in parallel with the layout's auth check, so check again here.
	if (!locals.user) redirect(302, '/login');
	const { channel, permissions } = await loadChannel(locals.user.id, params.id);

	const target = { channelId: channel.id };
	const [messages, mentionable] = await Promise.all([
		listMessages(target),
		listMentionable(target)
	]);
	return {
		channel: { id: channel.id, type: channel.type, name: channel.name, topic: channel.topic },
		messages,
		mentionable,
		canSend: hasPermission(permissions, Permission.SendMessages),
		canReact: hasPermission(permissions, Permission.AddReactions),
		canAttach:
			hasPermission(permissions, Permission.SendMessages) &&
			hasPermission(permissions, Permission.AttachFiles),
		maxUploadSize: await getMaxUploadSize(),
		/** Voice channels can additionally be joined to talk. */
		canConnect: isJoinable(channel.type) && hasPermission(permissions, Permission.Connect)
	};
};

export const actions: Actions = {
	send: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { channel, permissions } = await loadChannel(locals.user.id, params.id);
		if (!hasPermission(permissions, Permission.SendMessages)) {
			return fail(403, { error: 'You cannot send messages in this channel.' });
		}

		const form = await request.formData();
		const attachments = parseAttachmentIds(form.getAll('attachment'));
		if (!attachments.ok) return fail(400, { error: attachments.error });
		const result = normalizeContent(form.get('content'), {
			allowEmpty: attachments.ids.length > 0
		});
		if (!result.ok) return fail(400, { error: result.error });

		if (attachments.ids.length > 0 && !hasPermission(permissions, Permission.AttachFiles)) {
			return fail(403, { error: 'You cannot share files in this channel.' });
		}

		const sent = await createMessage({ channelId: channel.id }, locals.user.id, result.content, {
			attachmentIds: attachments.ids,
			replyToId: parseReplyTo(form.get('replyTo'))
		}).catch(rejection);
		if ('rejected' in sent) return fail(400, { error: sent.rejected });
		publish(channel.id, { type: 'message.created', message: sent });
		await notifyActivity(sent);
		return { message: sent };
	},

	react: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { channel, permissions } = await loadChannel(locals.user.id, params.id);
		if (!hasPermission(permissions, Permission.AddReactions)) {
			return fail(403, { error: 'You cannot add reactions in this channel.' });
		}

		const form = await request.formData();
		const emoji = parseEmoji(form.get('emoji'));
		if (!emoji) return fail(400, { error: 'That is not an emoji.' });

		const reactions = await toggleReaction(
			{ channelId: channel.id },
			form.get('messageId'),
			locals.user.id,
			emoji
		).catch(rejection);
		if (!reactions) return fail(404, { error: 'Message not found.' });
		if ('rejected' in reactions) return fail(400, { error: reactions.rejected });
		const messageId = String(form.get('messageId'));
		publish(channel.id, { type: 'reaction.changed', messageId, reactions });
		return { messageId, reactions };
	},

	read: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { channel } = await loadChannel(locals.user.id, params.id);

		const form = await request.formData();
		if (!(await markRead({ channelId: channel.id }, locals.user.id, form.get('messageId')))) {
			return fail(404, { error: 'Message not found.' });
		}
		return { read: true };
	}
};
