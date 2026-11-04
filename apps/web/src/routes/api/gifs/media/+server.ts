import { error } from '@sveltejs/kit';
import { fetchGif } from '#lib/server/gifs.ts';
import type { RequestHandler } from './$types';

/**
 * Passes a GIF from Giphy or Tenor on to the browser, so those services do not learn who reads
 * a chat. Works without an API key, so GIFs sent earlier keep showing.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Not signed in');
	const response = await fetchGif(url.searchParams.get('url') ?? '');
	if (!response) error(404, 'GIF not found');
	return response;
};
