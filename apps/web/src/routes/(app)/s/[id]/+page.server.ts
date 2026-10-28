import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { channel, member, server } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();

	const [row] = await db
		.select({ id: server.id, name: server.name })
		.from(server)
		.innerJoin(member, and(eq(member.serverId, server.id), eq(member.userId, user.id)))
		.where(eq(server.id, params.id));
	if (!row) error(404, 'Server not found');

	const channels = await db
		.select()
		.from(channel)
		.where(eq(channel.serverId, row.id))
		.orderBy(asc(channel.position));

	return { server: row, channels };
};
