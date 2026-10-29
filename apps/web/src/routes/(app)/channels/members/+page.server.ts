import { error, fail, redirect } from '@sveltejs/kit';
import { parseBanReason } from '#lib/moderation.ts';
import { banMember, kickMember, listMembersFor } from '#lib/server/moderation.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * Everyone on the server. Members with Kick or Ban members can remove people here; bans are
 * lifted in the server settings.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { members: await listMembersFor(locals.user.id) };
};

export const actions: Actions = {
	kick: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const userId = (await request.formData()).get('userId');
		if (typeof userId !== 'string') return fail(400, { error: 'Pick someone to kick.' });

		const result = await kickMember(locals.user.id, userId);
		if (!result.ok) return fail(403, { error: result.error });
		return { kicked: true };
	},
	ban: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const userId = form.get('userId');
		if (typeof userId !== 'string') return fail(400, { error: 'Pick someone to ban.' });
		const reason = parseBanReason(form.get('reason'));
		if (!reason.ok) return fail(400, { error: reason.error });

		const result = await banMember(locals.user.id, userId, reason.reason);
		if (!result.ok) return fail(403, { error: result.error });
		return { banned: true };
	}
};
