import { error, fail, redirect } from '@sveltejs/kit';
import { parseAttachmentIds } from '#lib/attachments.ts';
import { normalizeContent } from '#lib/chat.ts';
import { getMaxUploadSize } from '#lib/server/attachments.ts';
import { canSendInConversation, getConversation } from '#lib/server/conversations.ts';
import { attachmentError, createMessage, listMessages } from '#lib/server/messages.ts';
import { publish } from '#lib/server/realtime.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadConversation(userId: string, conversationId: string) {
	const conversation = await getConversation(conversationId, userId);
	if (!conversation) error(404, 'Conversation not found');

	return { conversation, canSend: await canSendInConversation(conversation, userId) };
}

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	// Server loads run in parallel with the layout's auth check, so check again here.
	if (!locals.user) redirect(302, '/login');
	// Group name and members change live, see `notify` in `#lib/server/groups.ts`.
	depends('app:home');
	const { conversation, canSend } = await loadConversation(locals.user.id, params.id);

	return {
		conversation,
		messages: await listMessages({ conversationId: conversation.id }),
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

		const message = await createMessage(
			{ conversationId: conversation.id },
			locals.user.id,
			result.content,
			attachments.ids
		).catch(attachmentError);
		if (!message) return fail(400, { error: 'A file is missing or still uploading.' });
		publish(conversation.id, { type: 'message.created', message });
		return { message };
	}
};
