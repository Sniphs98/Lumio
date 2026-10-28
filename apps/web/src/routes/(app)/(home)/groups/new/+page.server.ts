import { error, fail, redirect } from '@sveltejs/kit';
import { normalizeGroupName, parseUserIds } from '#lib/groups.ts';
import { createGroup } from '#lib/server/groups.ts';
import type { Actions } from './$types';

// The friends to pick from come from the Home layout's data.
export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const name = normalizeGroupName(form.get('name'));
		if (!name.ok) return fail(400, { error: name.error });

		const result = await createGroup(
			locals.user.id,
			name.name,
			parseUserIds(form.getAll('userId'))
		);
		if (!result.ok) return fail(400, { error: result.error });
		redirect(303, `/dm/${result.id}`);
	}
};
