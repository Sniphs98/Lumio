import { error, fail, redirect } from '@sveltejs/kit';
import { normalizeContent } from '#lib/chat.ts';
import { getConversation } from '#lib/server/conversations.ts';
import { areFriends } from '#lib/server/friends.ts';
import { createMessage, listMessages } from '#lib/server/messages.ts';
import { publish } from '#lib/server/realtime.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadConversation(userId: string, conversationId: string) {
	const conversation = await getConversation(conversationId, userId);
	if (!conversation) error(404, 'Conversation not found');

	// Direct messages need an accepted friendship; group members can always write.
	const canSend =
		conversation.type === 'group' ||
		(conversation.others.length === 1 && (await areFriends(userId, conversation.others[0].id)));
	return { conversation, canSend };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	// Server loads run in parallel with the layout's auth check, so check again here.
	if (!locals.user) redirect(302, '/login');
	const { conversation, canSend } = await loadConversation(locals.user.id, params.id);

	return {
		conversation,
		messages: await listMessages({ conversationId: conversation.id }),
		canSend
	};
};

export const actions: Actions = {
	send: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { conversation, canSend } = await loadConversation(locals.user.id, params.id);
		if (!canSend) return fail(403, { error: 'You can only message your friends.' });

		const form = await request.formData();
		const result = normalizeContent(form.get('content'));
		if (!result.ok) return fail(400, { error: result.error });

		const message = await createMessage(
			{ conversationId: conversation.id },
			locals.user.id,
			result.content
		);
		publish(conversation.id, { type: 'message.created', message });
		return { message };
	}
};
