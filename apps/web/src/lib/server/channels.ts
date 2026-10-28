import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { hasPermission, Permission, resolvePermissions } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { channel, channelOverwrite, instance, role, userRole } from '#lib/server/db/schema.ts';
import { EVERYONE_ROLE_NAME } from '#lib/server/instance.ts';

export async function listChannels() {
	return db
		.select({ id: channel.id, type: channel.type, name: channel.name, topic: channel.topic })
		.from(channel)
		.orderBy(asc(channel.position), asc(channel.createdAt));
}

/** Ids of the channels of a type the user may see. */
export async function listVisibleChannelIds(
	userId: string,
	type: 'text' | 'voice'
): Promise<Set<string>> {
	const channels = (await listChannels()).filter((c) => c.type === type);
	const permissions = await Promise.all(channels.map((c) => getChannelPermissions(userId, c.id)));
	return new Set(
		channels
			.filter((_, i) => hasPermission(permissions[i], Permission.ViewChannel))
			.map((c) => c.id)
	);
}

export async function getChannel(channelId: string) {
	const [row] = await db.select().from(channel).where(eq(channel.id, channelId));
	return row ?? null;
}

async function isInstanceOwner(userId: string): Promise<boolean> {
	const [inst] = await db.select({ ownerId: instance.ownerId }).from(instance);
	return inst?.ownerId === userId;
}

/** The `@everyone` role plus every role the user has. */
async function getUserRoles(userId: string) {
	return db
		.select({ id: role.id, permissions: role.permissions })
		.from(role)
		.leftJoin(userRole, and(eq(userRole.roleId, role.id), eq(userRole.userId, userId)))
		.where(or(eq(role.name, EVERYONE_ROLE_NAME), eq(userRole.userId, userId)));
}

/** Permission mask of a user outside any channel, e.g. for creating invites. */
export async function getServerPermissions(userId: string): Promise<bigint> {
	const isOwner = await isInstanceOwner(userId);
	if (isOwner) return resolvePermissions({ isOwner, rolePermissions: [] });
	const roles = await getUserRoles(userId);
	return resolvePermissions({ isOwner, rolePermissions: roles.map((r) => r.permissions) });
}

/** Effective permission mask of a user in a channel. */
export async function getChannelPermissions(userId: string, channelId: string): Promise<bigint> {
	const isOwner = await isInstanceOwner(userId);
	if (isOwner) return resolvePermissions({ isOwner, rolePermissions: [] });

	const roles = await getUserRoles(userId);

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
