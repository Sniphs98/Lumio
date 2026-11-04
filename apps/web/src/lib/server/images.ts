import { eq } from 'drizzle-orm';
import { checkImage, imageIdFromUrl, imageUrl } from '#lib/images.ts';
import { db } from '#lib/server/db/index.ts';
import { image, user } from '#lib/server/db/schema.ts';
import { storage } from '#lib/server/uploads.ts';

/** Where a picture's file lives in the upload store. */
export const imageKey = (id: string) => `images/${id}`;

export type StoredImage = { ok: true; url: string } | { ok: false; error: string };

/**
 * Stores the picture sent in a form field. Returns its address, to be saved where it is used,
 * or why it was rejected.
 */
export async function storeImage(
	uploaderId: string,
	value: FormDataEntryValue | null
): Promise<StoredImage> {
	const bytes = value instanceof File ? new Uint8Array(await value.arrayBuffer()) : null;
	const check = checkImage(bytes);
	if (!check.ok) return check;

	const [row] = await db
		.insert(image)
		.values({ uploaderId, mimeType: check.type, size: bytes!.length })
		.returning({ id: image.id });
	try {
		await storage.put(imageKey(row.id), bytes!, check.type);
	} catch (err) {
		await db.delete(image).where(eq(image.id, row.id));
		throw err;
	}
	return { ok: true, url: imageUrl(row.id) };
}

/** Deletes a picture stored by Lumio. Other addresses, and none, are ignored. */
export async function deleteImage(url: string | null | undefined): Promise<void> {
	const id = imageIdFromUrl(url);
	if (!id) return;
	await db.delete(image).where(eq(image.id, id));
	await storage.delete(imageKey(id)).catch(() => {});
}

export async function getImage(id: string) {
	const [row] = await db.select().from(image).where(eq(image.id, id));
	return row ?? null;
}

/** Sets or (with null) removes a user's profile picture, deleting the one it replaces. */
export async function setProfilePicture(userId: string, url: string | null): Promise<void> {
	const [old] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
	await db.update(user).set({ image: url }).where(eq(user.id, userId));
	if (old?.image !== url) await deleteImage(old?.image);
}
