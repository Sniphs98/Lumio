import { redirect } from '@sveltejs/kit';
import { listChannels } from '#lib/server/channels.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { channels: await listChannels() };
};
