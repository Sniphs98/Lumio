import { error, fail, redirect } from '@sveltejs/kit';
import { moderationError, parseBanReason } from '#lib/moderation.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions, isInstanceOwner } from '#lib/server/channels.ts';
import {
	banMember,
	kickMember,
	listBans,
	listMembers,
	unbanMember
} from '#lib/server/moderation.ts';
import type { Actions, PageServerLoad } from './$types';

/** Everyone on the server. Members with Kick or Ban members can remove people here. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const meId = locals.user.id;
	const [permissions, isOwner, members] = await Promise.all([
		getServerPermissions(meId),
		isInstanceOwner(meId),
		listMembers()
	]);
	const canBan = hasPermission(permissions, Permission.BanMembers);
	const actor = { id: meId, isOwner, permissions };
	// What the user may do to each member, so the page only offers what works.
	const withActions = await Promise.all(
		members.map(async (m) => {
			const target = {
				id: m.id,
				isOwner: m.isOwner,
				permissions: await getServerPermissions(m.id)
			};
			return {
				...m,
				canKick: moderationError('kick', actor, target) === null,
				canBan: moderationError('ban', actor, target) === null
			};
		})
	);
	return { members: withActions, bans: canBan ? await listBans() : [], canBan };
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
	},
	unban: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const permissions = await getServerPermissions(locals.user.id);
		if (!hasPermission(permissions, Permission.BanMembers)) {
			return fail(403, { error: 'You cannot lift bans.' });
		}
		const userId = (await request.formData()).get('userId');
		if (typeof userId !== 'string' || !(await unbanMember(userId))) {
			return fail(404, { error: 'This ban no longer exists.' });
		}
		return { unbanned: true };
	}
};
