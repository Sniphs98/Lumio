import { eq } from 'drizzle-orm';
import { GIPHY_API_KEY, TENOR_API_KEY } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { instance } from '#lib/server/db/schema.ts';
import { gifProviderFrom, type GifProvider } from '#lib/server/gifs.ts';

/** Whether a key comes from the environment; then the server settings cannot change it. */
export const gifKeyFromEnv = Boolean(GIPHY_API_KEY || TENOR_API_KEY);

async function storedGiphyKey(): Promise<string | null> {
	const [row] = await db.select({ key: instance.giphyApiKey }).from(instance);
	return row?.key ?? null;
}

/** The GIF service to search: from the environment, else the key from the server settings. */
export async function getGifProvider(): Promise<GifProvider | null> {
	if (gifKeyFromEnv) return gifProviderFrom({ GIPHY_API_KEY, TENOR_API_KEY });
	const key = await storedGiphyKey();
	return key ? gifProviderFrom({ GIPHY_API_KEY: key }) : null;
}

/** What the server settings show about GIFs. The key itself never leaves the server. */
export async function getGifSettings() {
	return { fromEnv: gifKeyFromEnv, hasKey: gifKeyFromEnv || (await storedGiphyKey()) !== null };
}

/** Sets or (with null) removes the Giphy key of the server settings. */
export async function setGiphyApiKey(key: string | null): Promise<void> {
	await db.update(instance).set({ giphyApiKey: key }).where(eq(instance.id, 1));
}
