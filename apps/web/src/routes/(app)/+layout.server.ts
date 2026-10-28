import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { member, server } from '#lib/server/db/schema.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');

	const servers = await db
		.select({ id: server.id, name: server.name, iconUrl: server.iconUrl })
		.from(member)
		.innerJoin(server, eq(member.serverId, server.id))
		.where(eq(member.userId, user.id));

	return { user: { id: user.id, name: user.name, image: user.image ?? null }, servers };
};
