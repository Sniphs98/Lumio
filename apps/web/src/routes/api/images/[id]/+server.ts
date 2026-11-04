import { error } from '@sveltejs/kit';
import { imageIdFromUrl, isImageId } from '#lib/images.ts';
import { getImage, imageKey } from '#lib/server/images.ts';
import { getInstance } from '#lib/server/instance.ts';
import { storage } from '#lib/server/uploads.ts';
import type { RequestHandler } from './$types';

/**
 * Serves a profile picture, server icon or group picture to signed-in users. The server icon is
 * also served to people who are not signed in yet, for the invite page. A picture never
 * changes under its address (a new one gets a new address), so browsers keep it for a long time.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!isImageId(params.id)) error(404, 'Picture not found');
	if (!locals.user && imageIdFromUrl((await getInstance())?.iconUrl) !== params.id) {
		error(401, 'Not signed in');
	}
	const row = await getImage(params.id);
	if (!row) error(404, 'Picture not found');

	const body = await storage.read(imageKey(row.id)).catch(() => null);
	if (!body) error(404, 'Picture not found');
	return new Response(body, {
		headers: {
			'Content-Type': row.mimeType,
			'Content-Length': String(row.size),
			'Cache-Control': 'private, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'; sandbox"
		}
	});
};
