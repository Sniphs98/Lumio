import { error, fail, redirect } from '@sveltejs/kit';
import { normalizeGroupName, parseUserIds } from '#lib/groups.ts';
import {
	addGroupMembers,
	getGroup,
	listAddableFriends,
	removeGroupMember,
	renameGroup
} from '#lib/server/groups.ts';
import type { Actions, PageServerLoad } from './$types';

async function requireGroup(conversationId: string, userId: string) {
	const group = await getGroup(conversationId, userId);
	if (!group) error(404, 'Group not found');
	return group;
}

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	if (!locals.user) redirect(302, '/login');
	depends('app:home');
	const group = await requireGroup(params.id, locals.user.id);
	return { group, addable: await listAddableFriends(group, locals.user.id) };
};

export const actions: Actions = {
	rename: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const group = await requireGroup(params.id, locals.user.id);
		const name = normalizeGroupName((await request.formData()).get('name'));
		if (!name.ok) return fail(400, { renameError: name.error });

		await renameGroup(group, locals.user.id, name.name);
		return { renamed: true };
	},
	add: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const group = await requireGroup(params.id, locals.user.id);
		const ids = parseUserIds((await request.formData()).getAll('userId'));

		const result = await addGroupMembers(group, locals.user.id, ids);
		if (!result.ok) return fail(400, { addError: result.error });
		return { added: true };
	},
	remove: async ({ params, locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const group = await requireGroup(params.id, locals.user.id);
		const userId = (await request.formData()).get('userId');
		if (typeof userId !== 'string') return fail(400, { membersError: 'Pick someone to remove.' });

		const result = await removeGroupMember(group, locals.user.id, userId);
		if (!result.ok) return fail(403, { membersError: result.error });
		return { removed: true };
	},
	leave: async ({ params, locals }) => {
		if (!locals.user) error(401, 'Not signed in');
		const group = await requireGroup(params.id, locals.user.id);
		await removeGroupMember(group, locals.user.id, locals.user.id);
		redirect(303, '/');
	}
};
