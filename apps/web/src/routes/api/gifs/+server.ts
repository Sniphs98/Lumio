import { error, json } from '@sveltejs/kit';
import { MAX_GIF_QUERY_LENGTH } from '#lib/gifs.ts';
import { getGifProvider } from '#lib/server/gif-provider.ts';
import type { RequestHandler } from './$types';

/** GIFs to pick from: search results for `q`, or trending GIFs. `next` loads more. */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Not signed in');
	const gifProvider = await getGifProvider();
	if (!gifProvider) error(404, 'GIFs are not set up on this server.');

	const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_GIF_QUERY_LENGTH);
	const next = url.searchParams.get('next') || null;
	const page = await gifProvider.search(query, next, 24).catch((cause) => {
		console.error(cause);
		error(502, 'Could not load GIFs.');
	});
	return json(page, { headers: { 'Cache-Control': 'private, max-age=60' } });
};
