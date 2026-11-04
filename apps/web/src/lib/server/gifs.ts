/**
 * GIF search through Giphy or Tenor, whichever has an API key. Both are optional: without a key
 * the GIF picker is off, while GIFs sent earlier still show.
 */
import { isGifUrl, type GifPage, type GifResult } from '#lib/gifs.ts';

export type GifProvider = {
	name: 'giphy' | 'tenor';
	/** Search results, or trending GIFs for an empty query. */
	search(query: string, next: string | null, limit: number): Promise<GifPage>;
};

type Fetch = typeof fetch;

/** The provider for the configured API keys. Giphy wins when both are set. */
export function gifProviderFrom(
	keys: { GIPHY_API_KEY?: string; TENOR_API_KEY?: string },
	fetcher: Fetch = fetch
): GifProvider | null {
	if (keys.GIPHY_API_KEY) return giphy(keys.GIPHY_API_KEY, fetcher);
	if (keys.TENOR_API_KEY) return tenor(keys.TENOR_API_KEY, fetcher);
	return null;
}

/** Drops tracking parameters, so the stored address only names the file. */
function cleanUrl(raw: string | undefined): string | null {
	if (!raw) return null;
	try {
		const url = new URL(raw);
		url.search = '';
		url.hash = '';
		return isGifUrl(url.href) ? url.href : null;
	} catch {
		return null;
	}
}

async function getJson(fetcher: Fetch, url: URL): Promise<unknown> {
	const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
	if (!response.ok) throw new Error(`GIF search failed with status ${response.status}`);
	return response.json();
}

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyResponse = {
	data?: {
		id: string;
		title?: string;
		images?: Record<string, GiphyImage | undefined>;
	}[];
	pagination?: { total_count?: number; count?: number; offset?: number };
};

function giphy(apiKey: string, fetcher: Fetch): GifProvider {
	return {
		name: 'giphy',
		async search(query, next, limit) {
			const url = new URL(`https://api.giphy.com/v1/gifs/${query ? 'search' : 'trending'}`);
			url.searchParams.set('api_key', apiKey);
			if (query) url.searchParams.set('q', query);
			url.searchParams.set('limit', String(limit));
			url.searchParams.set('offset', String(Number(next) || 0));
			url.searchParams.set('rating', 'pg-13');
			url.searchParams.set('bundle', 'messaging_non_clips');
			const body = (await getJson(fetcher, url)) as GiphyResponse;

			const results: GifResult[] = [];
			for (const item of body.data ?? []) {
				const full = item.images?.fixed_height;
				const small = item.images?.fixed_width_downsampled ?? item.images?.fixed_width ?? full;
				const sent = cleanUrl(full?.webp ?? full?.url);
				const preview = cleanUrl(small?.webp ?? small?.url) ?? sent;
				if (!sent || !preview) continue;
				results.push({
					id: item.id,
					title: item.title?.trim() || 'GIF',
					url: sent,
					preview,
					width: Number(full?.width) || 200,
					height: Number(full?.height) || 200
				});
			}
			const { offset = 0, count = 0, total_count = 0 } = body.pagination ?? {};
			const more = count > 0 && offset + count < total_count;
			return { results, next: more ? String(offset + count) : null };
		}
	};
}

type TenorFormat = { url?: string; dims?: number[] };
type TenorResponse = {
	results?: {
		id: string;
		content_description?: string;
		media_formats?: Record<string, TenorFormat | undefined>;
	}[];
	next?: string;
};

function tenor(apiKey: string, fetcher: Fetch): GifProvider {
	return {
		name: 'tenor',
		async search(query, next, limit) {
			const url = new URL(`https://tenor.googleapis.com/v2/${query ? 'search' : 'featured'}`);
			url.searchParams.set('key', apiKey);
			url.searchParams.set('client_key', 'lumio');
			if (query) url.searchParams.set('q', query);
			url.searchParams.set('limit', String(limit));
			if (next) url.searchParams.set('pos', next);
			url.searchParams.set('media_filter', 'gif,mediumgif,tinygif');
			url.searchParams.set('contentfilter', 'medium');
			const body = (await getJson(fetcher, url)) as TenorResponse;

			const results: GifResult[] = [];
			for (const item of body.results ?? []) {
				const formats = item.media_formats ?? {};
				const full = formats.mediumgif ?? formats.gif;
				const sent = cleanUrl(full?.url);
				const preview = cleanUrl(formats.tinygif?.url) ?? sent;
				if (!sent || !preview) continue;
				results.push({
					id: item.id,
					title: item.content_description?.trim() || 'GIF',
					url: sent,
					preview,
					width: full?.dims?.[0] || 200,
					height: full?.dims?.[1] || 200
				});
			}
			const more = Boolean(body.next) && body.next !== '0' && results.length > 0;
			return { results, next: more ? (body.next ?? null) : null };
		}
	};
}

/** Largest GIF the proxy passes on. */
export const MAX_GIF_SIZE = 20 * 1024 ** 2;

/**
 * Loads a GIF for the browser. Only follows no redirects and only accepts images, so it cannot
 * be used to reach other addresses or to serve anything else.
 */
export async function fetchGif(url: string, fetcher: Fetch = fetch): Promise<Response | null> {
	if (!isGifUrl(url)) return null;
	const upstream = await fetcher(url, {
		redirect: 'manual',
		signal: AbortSignal.timeout(15000)
	}).catch(() => null);
	if (!upstream?.ok || !upstream.body) return null;

	const type = upstream.headers.get('content-type') ?? '';
	if (!/^image\/(gif|webp|png|jpeg)$/.test(type.split(';')[0].trim())) return null;
	const length = Number(upstream.headers.get('content-length'));
	if (length > MAX_GIF_SIZE) return null;

	let received = 0;
	const limited = upstream.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				received += chunk.byteLength;
				if (received > MAX_GIF_SIZE) controller.error(new Error('GIF is too large'));
				else controller.enqueue(chunk);
			}
		})
	);
	const headers = new Headers({
		'Content-Type': type,
		// GIF files never change.
		'Cache-Control': 'private, max-age=604800, immutable',
		'Content-Security-Policy': "default-src 'none'"
	});
	if (length) headers.set('Content-Length', String(length));
	return new Response(limited, { headers });
}

/** Asks Giphy whether a key works, before the server settings save it. */
export async function checkGiphyKey(
	key: string,
	fetcher: Fetch = fetch
): Promise<'ok' | 'invalid' | 'unreachable'> {
	const url = new URL('https://api.giphy.com/v1/gifs/trending');
	url.searchParams.set('api_key', key);
	url.searchParams.set('limit', '1');
	const response = await fetcher(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
	if (!response) return 'unreachable';
	if (response.ok) return 'ok';
	return response.status === 401 || response.status === 403 ? 'invalid' : 'unreachable';
}
