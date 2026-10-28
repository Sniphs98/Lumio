import { error, fail, redirect } from '@sveltejs/kit';
import { parseMaxUploadSize } from '#lib/attachments.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getMaxUploadSize, setMaxUploadSize } from '#lib/server/attachments.ts';
import { getServerPermissions } from '#lib/server/channels.ts';
import type { Actions, PageServerLoad } from './$types';

async function requireManageServer(userId: string) {
	const permissions = await getServerPermissions(userId);
	if (!hasPermission(permissions, Permission.ManageServer)) {
		error(403, 'You are not allowed to change the server settings.');
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	await requireManageServer(locals.user.id);
	return { maxUploadSize: await getMaxUploadSize() };
};

export const actions: Actions = {
	uploads: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		await requireManageServer(locals.user.id);
		const parsed = parseMaxUploadSize((await request.formData()).get('maxUploadSizeMb'));
		if (!parsed.ok) return fail(400, { uploadsError: parsed.error });

		await setMaxUploadSize(parsed.bytes);
		return { uploadsSaved: true };
	}
};
