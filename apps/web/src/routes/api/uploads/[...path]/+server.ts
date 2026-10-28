import { error } from '@sveltejs/kit';
import { handleUpload } from '#lib/server/uploads.ts';
import type { RequestHandler } from './$types';

/**
 * Resumable uploads with the tus protocol (https://tus.io): `POST` starts an upload, `PATCH` sends
 * the next piece, `HEAD` tells the browser how much arrived, so it can resume after a dropped connection.
 */
const handler: RequestHandler = ({ request, locals }) => {
	if (!locals.user) error(401, 'Not signed in');
	return handleUpload(request, locals.user.id);
};

export const POST = handler;
export const PATCH = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;
