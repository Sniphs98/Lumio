import { redirect } from '@sveltejs/kit';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions, listChannels } from '#lib/server/channels.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [channels, permissions] = await Promise.all([
		listChannels(),
		getServerPermissions(locals.user.id)
	]);
	return {
		channels,
		canInvite: hasPermission(permissions, Permission.CreateInvite),
		canManageServer: hasPermission(permissions, Permission.ManageServer)
	};
};
