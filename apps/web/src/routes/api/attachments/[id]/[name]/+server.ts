import { error } from '@sveltejs/kit';
import { parseRange, previewKind } from '#lib/attachments.ts';
import { getReadableAttachment } from '#lib/server/attachments.ts';
import { storage } from '#lib/server/uploads.ts';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Downloads a shared file. Images, videos and audio are shown inline; any other type is sent as a
 * download, so uploaded HTML or SVG never runs on the app's origin. Supports range requests for
 * seeking in videos and resuming downloads.
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');
	if (!UUID.test(params.id)) error(404, 'File not found');
	const file = await getReadableAttachment(params.id, locals.user.id);
	if (!file) error(404, 'File not found');

	const inline = previewKind(file.mimeType) !== 'file';
	const headers = new Headers({
		'Content-Type': inline ? file.mimeType : 'application/octet-stream',
		'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'private, max-age=86400',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'; sandbox"
	});

	const range = parseRange(request.headers.get('range'), file.size);
	if (range === 'invalid') {
		headers.set('Content-Range', `bytes */${file.size}`);
		return new Response(null, { status: 416, headers });
	}
	if (request.method === 'HEAD' || file.size === 0) {
		headers.set('Content-Length', String(file.size));
		return new Response(null, { status: 200, headers });
	}

	const body = await storage.read(file.id, range ?? undefined);
	if (range) {
		headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
		headers.set('Content-Length', String(range.end - range.start + 1));
		return new Response(body, { status: 206, headers });
	}
	headers.set('Content-Length', String(file.size));
	return new Response(body, { status: 200, headers });
};
