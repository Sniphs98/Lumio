import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { resolvePermissions } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { channel, channelOverwrite, instance, role, userRole } from '#lib/server/db/schema.ts';
import { EVERYONE_ROLE_NAME } from '#lib/server/instance.ts';

export async function listChannels() {
	return db
		.select({ id: channel.id, type: channel.type, name: channel.name, topic: channel.topic })
		.from(channel)
		.orderBy(asc(channel.position), asc(channel.createdAt));
}

export async function getChannel(channelId: string) {
	const [row] = await db.select().from(channel).where(eq(channel.id, channelId));
	return row ?? null;
}

/** Effective permission mask of a user in a channel. */
export async function getChannelPermissions(userId: string, channelId: string): Promise<bigint> {
	const [inst] = await db.select({ ownerId: instance.ownerId }).from(instance);
	const isOwner = inst?.ownerId === userId;
	if (isOwner) return resolvePermissions({ isOwner, rolePermissions: [] });

	const roles = await db
		.select({ id: role.id, permissions: role.permissions })
		.from(role)
		.leftJoin(userRole, and(eq(userRole.roleId, role.id), eq(userRole.userId, userId)))
		.where(or(eq(role.name, EVERYONE_ROLE_NAME), eq(userRole.userId, userId)));

	const roleIds = roles.map((r) => r.id);
	const overwrites = await db
		.select()
		.from(channelOverwrite)
		.where(
			and(
				eq(channelOverwrite.channelId, channelId),
				or(
					roleIds.length > 0 ? inArray(channelOverwrite.roleId, roleIds) : undefined,
					and(isNull(channelOverwrite.roleId), eq(channelOverwrite.userId, userId))
				)
			)
		);

	return resolvePermissions({
		isOwner,
		rolePermissions: roles.map((r) => r.permissions),
		roleOverwrites: overwrites.filter((o) => o.roleId !== null),
		userOverwrite: overwrites.find((o) => o.roleId === null) ?? null
	});
}
