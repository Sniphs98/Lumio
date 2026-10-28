import { eq } from 'drizzle-orm';
import { DEFAULT_PERMISSIONS } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { channel, instance, role } from '#lib/server/db/schema.ts';

export const EVERYONE_ROLE_NAME = '@everyone';

export async function getInstance() {
	const [row] = await db.select().from(instance).where(eq(instance.id, 1));
	return row ?? null;
}

/**
 * Called after every sign-up. The first user to register sets up the instance:
 * they become its owner, and the `@everyone` role and default channels are created.
 * Later sign-ups do nothing here.
 */
export async function setUpInstanceIfNeeded(userId: string, userName: string): Promise<void> {
	await db.transaction(async (tx) => {
		const created = await tx
			.insert(instance)
			.values({ id: 1, name: `${userName}'s Lumio`, ownerId: userId })
			.onConflictDoNothing()
			.returning({ id: instance.id });
		if (created.length === 0) return;

		await tx.insert(role).values({
			name: EVERYONE_ROLE_NAME,
			position: 0,
			permissions: DEFAULT_PERMISSIONS
		});
		await tx.insert(channel).values([
			{ type: 'text', name: 'general', position: 0 },
			{ type: 'voice', name: 'Lounge', position: 1 }
		]);
	});
}
