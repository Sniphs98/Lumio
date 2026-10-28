import { error, fail, redirect } from '@sveltejs/kit';
import { parseInviteSettings } from '#lib/invites.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions } from '#lib/server/channels.ts';
import { createInvite, listActiveInvites, revokeInvite } from '#lib/server/invites.ts';
import type { Actions, PageServerLoad } from './$types';

/** Members with Create invite manage their own links; Manage server sees and revokes all of them. */
async function loadAccess(userId: string) {
	const permissions = await getServerPermissions(userId);
	if (!hasPermission(permissions, Permission.CreateInvite)) {
		error(403, 'You are not allowed to invite people.');
	}
	return { canManageAll: hasPermission(permissions, Permission.ManageServer) };
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const { canManageAll } = await loadAccess(locals.user.id);
	const invites = await listActiveInvites(canManageAll ? undefined : locals.user.id);
	return {
		invites: invites.map((i) => ({
			...i,
			canRevoke: canManageAll || i.createdById === locals.user?.id
		})),
		canManageAll
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		await loadAccess(locals.user.id);
		const form = await request.formData();
		const parsed = parseInviteSettings(form.get('expiry'), form.get('maxUses'));
		if (!parsed.ok) return fail(400, { inviteError: parsed.error });

		const invite = await createInvite(locals.user.id, parsed.settings);
		return { createdCode: invite.code };
	},
	revoke: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const { canManageAll } = await loadAccess(locals.user.id);
		const code = (await request.formData()).get('code');
		if (typeof code !== 'string' || !(await revokeInvite(code, locals.user.id, canManageAll))) {
			return fail(404, { inviteError: 'This invite link no longer exists.' });
		}
		return { revoked: true };
	}
};
