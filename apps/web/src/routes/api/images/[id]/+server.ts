import { error } from '@sveltejs/kit';
import { isImageId } from '#lib/images.ts';
import { getImage, imageKey } from '#lib/server/images.ts';
import { storage } from '#lib/server/uploads.ts';
import type { RequestHandler } from './$types';

/**
 * Serves a profile picture, server icon or group picture to signed-in users. A picture never
 * changes under its address (a new one gets a new address), so browsers keep it for a long time.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	if (!isImageId(params.id)) error(404, 'Picture not found');
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
