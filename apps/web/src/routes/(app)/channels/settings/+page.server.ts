import { error, fail, redirect } from '@sveltejs/kit';
import { parseMaxUploadSize, parseUploadQuotas } from '#lib/attachments.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import {
	getMaxUploadSize,
	getUploadQuotas,
	setMaxUploadSize,
	setUploadQuotas
} from '#lib/server/attachments.ts';
import { getServerPermissions } from '#lib/server/channels.ts';
import { getInstance, setInstancePublic } from '#lib/server/instance.ts';
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
	const [maxUploadSize, quotas, inst] = await Promise.all([
		getMaxUploadSize(),
		getUploadQuotas(),
		getInstance()
	]);
	return { maxUploadSize, quotas, isPublic: inst?.isPublic ?? false };
};

export const actions: Actions = {
	access: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		await requireManageServer(locals.user.id);
		// A switch only sends a value when it is on.
		await setInstancePublic((await request.formData()).get('isPublic') === 'on');
		return { accessSaved: true };
	},
	uploads: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		await requireManageServer(locals.user.id);
		const parsed = parseMaxUploadSize((await request.formData()).get('maxUploadSizeMb'));
		if (!parsed.ok) return fail(400, { uploadsError: parsed.error });

		await setMaxUploadSize(parsed.bytes);
		return { uploadsSaved: true };
	},
	storage: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		await requireManageServer(locals.user.id);
		const form = await request.formData();
		const parsed = parseUploadQuotas(
			form.get('quotaEnabled'),
			form.get('memberQuotaGb'),
			form.get('guestQuotaGb')
		);
		if (!parsed.ok) return fail(400, { storageError: parsed.error });

		await setUploadQuotas(parsed.quotas);
		return { storageSaved: true };
	}
};
