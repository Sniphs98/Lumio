import { error, fail, redirect } from '@sveltejs/kit';
import { parseAttachmentIds } from '#lib/attachments.ts';
import { normalizeContent, parseReplyTo } from '#lib/chat.ts';
import { getMaxUploadSize } from '#lib/server/attachments.ts';
import { canSendInConversation, getConversation } from '#lib/server/conversations.ts';
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

async function loadConversation(userId: string, conversationId: string) {
	const conversation = await getConversation(conversationId, userId);
	if (!conversation) error(404, 'Conversation not found');

	return { conversation, canSend: await canSendInConversation(conversation, userId) };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	// Server loads run in parallel with the layout's auth check, so check again here.
	if (!locals.user) redirect(302, '/login');
	const { conversation, canSend } = await loadConversation(locals.user.id, params.id);

	const target = { conversationId: conversation.id };
	const [messages, mentionable] = await Promise.all([
		listMessages(target),
		listMentionable(target)
	]);
	return {
		conversation,
		messages,
		mentionable,
		canSend,
		maxUploadSize: await getMaxUploadSize()
	};
};

export const actions: Actions = {
	send: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { conversation, canSend } = await loadConversation(locals.user.id, params.id);
		if (!canSend) return fail(403, { error: 'You can only message your friends.' });

		const form = await request.formData();
		const attachments = parseAttachmentIds(form.getAll('attachment'));
		if (!attachments.ok) return fail(400, { error: attachments.error });
		const result = normalizeContent(form.get('content'), {
			allowEmpty: attachments.ids.length > 0
		});
		if (!result.ok) return fail(400, { error: result.error });

		const sent = await createMessage(
			{ conversationId: conversation.id },
			locals.user.id,
			result.content,
			{
				attachmentIds: attachments.ids,
				replyToId: parseReplyTo(form.get('replyTo'))
			}
		).catch(rejection);
		if ('rejected' in sent) return fail(400, { error: sent.rejected });
		publish(conversation.id, { type: 'message.created', message: sent });
		await notifyActivity(sent);
		return { message: sent };
	},

	react: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { conversation, canSend } = await loadConversation(locals.user.id, params.id);
		if (!canSend) return fail(403, { error: 'You can only react in chats with your friends.' });

		const form = await request.formData();
		const emoji = parseEmoji(form.get('emoji'));
		if (!emoji) return fail(400, { error: 'That is not an emoji.' });

		const reactions = await toggleReaction(
			{ conversationId: conversation.id },
			form.get('messageId'),
			locals.user.id,
			emoji
		).catch(rejection);
		if (!reactions) return fail(404, { error: 'Message not found.' });
		if ('rejected' in reactions) return fail(400, { error: reactions.rejected });
		const messageId = String(form.get('messageId'));
		publish(conversation.id, { type: 'reaction.changed', messageId, reactions });
		return { messageId, reactions };
	},

	read: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { conversation } = await loadConversation(locals.user.id, params.id);

		const form = await request.formData();
		if (
			!(await markRead({ conversationId: conversation.id }, locals.user.id, form.get('messageId')))
		) {
			return fail(404, { error: 'Message not found.' });
		}
		return { read: true };
	}
};
