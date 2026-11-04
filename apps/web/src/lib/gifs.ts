/**
 * GIFs are sent as a message whose whole content is the GIF's address on Giphy or Tenor.
 * Browsers load them through `/api/gifs/media`, so the GIF services never see who reads a chat.
 */

/** One search result of the GIF picker. */
export type GifResult = {
	id: string;
	title: string;
	/** The GIF that is sent, on a host `isGifUrl` accepts. */
	url: string;
	/** A smaller version for the picker. */
	preview: string;
	width: number;
	height: number;
};

export type GifPage = {
	results: GifResult[];
	/** Pass back as `next` to load more results; null when there are no more. */
	next: string | null;
};

/** Longest search text. */
export const MAX_GIF_QUERY_LENGTH = 100;

/** Hosts the GIF services serve their files from. Only these are loaded through the proxy. */
const GIF_HOSTS = [/^(?:media\d?|i)\.giphy\.com$/, /^(?:media\d?|c)\.tenor\.com$/];

/** Whether an address is an HTTPS file of Giphy or Tenor. */
export function isGifUrl(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	return (
		url.protocol === 'https:' &&
		url.username === '' &&
		url.password === '' &&
		url.port === '' &&
		GIF_HOSTS.some((host) => host.test(url.hostname))
	);
}

/** The GIF a message shows: its content is exactly one GIF address. */
export function gifInContent(content: string): string | null {
	const trimmed = content.trim();
	return !/\s/.test(trimmed) && isGifUrl(trimmed) ? trimmed : null;
}

/** Where the browser loads a GIF from. */
export function gifMediaPath(url: string): string {
	return `/api/gifs/media?url=${encodeURIComponent(url)}`;
}

/** Checks a Giphy API key typed into the server settings. Returns the key, or an error text. */
export function parseGiphyKey(
	raw: unknown
): { ok: true; key: string } | { ok: false; error: string } {
	const key = typeof raw === 'string' ? raw.trim() : '';
	if (key === '') return { ok: false, error: 'Paste the API key of your GIPHY app.' };
	if (!/^[A-Za-z0-9]{16,64}$/.test(key)) {
		return { ok: false, error: 'That does not look like a GIPHY API key.' };
	}
	return { ok: true, key };
}
