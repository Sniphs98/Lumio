import { redirect } from '@sveltejs/kit';
import { getGifProvider } from '#lib/server/gif-provider.ts';
import { getInstance } from '#lib/server/instance.ts';
import { getUnreadCounts } from '#lib/server/unread.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');

	// Invalidated by the app layout when someone writes in a chat the user can see.
	event.depends('app:unread');
	const [inst, unread, gifProvider] = await Promise.all([
		getInstance(),
		getUnreadCounts(user.id),
		getGifProvider()
	]);

	return {
		user: {
			id: user.id,
			name: user.name,
			image: user.image ?? null,
			isGuest: user.isAnonymous === true
		},
		instance: { name: inst?.name ?? 'Lumio', iconUrl: inst?.iconUrl ?? null },
		/** The GIF service the composer searches, or null when GIFs are off. */
		gifProvider: gifProvider?.name ?? null,
		unread
	};
};
