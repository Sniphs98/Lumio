import { error, fail, redirect } from '@sveltejs/kit';
import { parseMaxUploadSize, parseUploadQuotas } from '#lib/attachments.ts';
import { parseServerName } from '#lib/instance.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { setMaxUploadSize, setUploadQuotas } from '#lib/server/attachments.ts';
import { getServerPermissions } from '#lib/server/channels.ts';
import { setInstanceName, setInstancePublic } from '#lib/server/instance.ts';
import { unbanMember } from '#lib/server/moderation.ts';
import type { Actions, PageServerLoad } from './$types';

async function requirePermission(userId: string | undefined, permission: bigint) {
	if (!userId) error(401, 'Not signed in');
	const permissions = await getServerPermissions(userId);
	if (!hasPermission(permissions, permission)) {
		error(403, 'You are not allowed to change the server settings.');
	}
}

/**
 * The server settings are a dialog in the channels layout; this route holds its form actions.
 * Opening the address directly opens the dialog.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const permissions = await getServerPermissions(locals.user.id);
	if (
		!hasPermission(permissions, Permission.ManageServer) &&
		!hasPermission(permissions, Permission.BanMembers)
	) {
		error(403, 'You are not allowed to change the server settings.');
	}
	redirect(303, '/channels?settings');
};

export const actions: Actions = {
	name: async ({ locals, request }) => {
		await requirePermission(locals.user?.id, Permission.ManageServer);
		const parsed = parseServerName((await request.formData()).get('name'));
		if (!parsed.ok) return fail(400, { error: parsed.error });

		await setInstanceName(parsed.name);
		return { saved: true };
	},
	access: async ({ locals, request }) => {
		await requirePermission(locals.user?.id, Permission.ManageServer);
		// A switch only sends a value when it is on.
		await setInstancePublic((await request.formData()).get('isPublic') === 'on');
		return { saved: true };
	},
	uploads: async ({ locals, request }) => {
		await requirePermission(locals.user?.id, Permission.ManageServer);
		const parsed = parseMaxUploadSize((await request.formData()).get('maxUploadSizeMb'));
		if (!parsed.ok) return fail(400, { error: parsed.error });

		await setMaxUploadSize(parsed.bytes);
		return { saved: true };
	},
	storage: async ({ locals, request }) => {
		await requirePermission(locals.user?.id, Permission.ManageServer);
		const form = await request.formData();
		const parsed = parseUploadQuotas(
			form.get('quotaEnabled'),
			form.get('memberQuotaGb'),
			form.get('guestQuotaGb')
		);
		if (!parsed.ok) return fail(400, { error: parsed.error });

		await setUploadQuotas(parsed.quotas);
		return { saved: true };
	},
	unban: async ({ locals, request }) => {
		await requirePermission(locals.user?.id, Permission.BanMembers);
		const userId = (await request.formData()).get('userId');
		if (typeof userId !== 'string' || !(await unbanMember(userId))) {
			return fail(404, { error: 'This ban no longer exists.' });
		}
		return { saved: true };
	}
};
