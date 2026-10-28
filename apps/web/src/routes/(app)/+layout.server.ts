import { redirect } from '@sveltejs/kit';
import { getInstance } from '#lib/server/instance.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');

	const inst = await getInstance();

	return {
		user: { id: user.id, name: user.name, image: user.image ?? null },
		instance: { name: inst?.name ?? 'Lumio' }
	};
};
