import { describe, expect, it, vi } from 'vitest';
import { checkGiphyKey, fetchGif, gifProviderFrom, MAX_GIF_SIZE } from './gifs.ts';

function jsonFetch(body: unknown) {
	return vi.fn<typeof fetch>(async () => Response.json(body));
}

describe('gifProviderFrom', () => {
	it('is off without keys and prefers Giphy', () => {
		expect(gifProviderFrom({})).toBeNull();
		expect(gifProviderFrom({ TENOR_API_KEY: 't' })?.name).toBe('tenor');
		expect(gifProviderFrom({ GIPHY_API_KEY: 'g', TENOR_API_KEY: 't' })?.name).toBe('giphy');
	});
});

describe('Giphy', () => {
	const body = {
		data: [
			{
				id: 'abc',
				title: 'Cat GIF',
				images: {
					fixed_height: {
						url: 'https://media2.giphy.com/media/abc/200.gif?cid=x',
						webp: 'https://media2.giphy.com/media/abc/200.webp?cid=x&rid=200.webp',
						width: '356',
						height: '200'
					},
					fixed_width_downsampled: { webp: 'https://media2.giphy.com/media/abc/200w_d.webp?cid=x' }
				}
			},
			{ id: 'bad', images: { fixed_height: { url: 'https://evil.example/a.gif' } } }
		],
		pagination: { total_count: 100, count: 2, offset: 24 }
	};

	it('searches, keeps clean Giphy addresses and pages by offset', async () => {
		const fetcher = jsonFetch(body);
		const provider = gifProviderFrom({ GIPHY_API_KEY: 'key' }, fetcher)!;
		const page = await provider.search('cat', '24', 24);

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.pathname).toBe('/v1/gifs/search');
		expect(url.searchParams.get('q')).toBe('cat');
		expect(url.searchParams.get('offset')).toBe('24');
		expect(url.searchParams.get('api_key')).toBe('key');
		expect(page).toEqual({
			results: [
				{
					id: 'abc',
					title: 'Cat GIF',
					url: 'https://media2.giphy.com/media/abc/200.webp',
					preview: 'https://media2.giphy.com/media/abc/200w_d.webp',
					width: 356,
					height: 200
				}
			],
			next: '26'
		});
	});

	it('shows trending GIFs for an empty search', async () => {
		const fetcher = jsonFetch({ data: [], pagination: { total_count: 0, count: 0, offset: 0 } });
		const page = await gifProviderFrom({ GIPHY_API_KEY: 'key' }, fetcher)!.search('', null, 24);
		expect(new URL(String(fetcher.mock.calls[0][0])).pathname).toBe('/v1/gifs/trending');
		expect(page).toEqual({ results: [], next: null });
	});

	it('fails when the service does', async () => {
		const fetcher = vi.fn(async () => new Response('nope', { status: 429 }));
		await expect(
			gifProviderFrom({ GIPHY_API_KEY: 'key' }, fetcher)!.search('cat', null, 24)
		).rejects.toThrow();
	});
});

describe('Tenor', () => {
	it('searches and pages by position', async () => {
		const fetcher = jsonFetch({
			results: [
				{
					id: '1',
					content_description: 'Dancing cat',
					media_formats: {
						mediumgif: { url: 'https://media.tenor.com/x/cat.gif', dims: [320, 240] },
						tinygif: { url: 'https://media.tenor.com/y/cat.gif', dims: [160, 120] }
					}
				}
			],
			next: 'CAgQ'
		});
		const provider = gifProviderFrom({ TENOR_API_KEY: 'key' }, fetcher)!;
		const page = await provider.search('cat', 'abc', 24);

		const url = new URL(String(fetcher.mock.calls[0][0]));
		expect(url.host).toBe('tenor.googleapis.com');
		expect(url.searchParams.get('pos')).toBe('abc');
		expect(page).toEqual({
			results: [
				{
					id: '1',
					title: 'Dancing cat',
					url: 'https://media.tenor.com/x/cat.gif',
					preview: 'https://media.tenor.com/y/cat.gif',
					width: 320,
					height: 240
				}
			],
			next: 'CAgQ'
		});
	});
});

describe('fetchGif', () => {
	const gif = 'https://media.tenor.com/x/cat.gif';

	it('passes on GIF images without following redirects', async () => {
		const fetcher = vi.fn<typeof fetch>(
			async () => new Response('GIF89a', { headers: { 'content-type': 'image/gif' } })
		);
		const response = await fetchGif(gif, fetcher);
		expect(fetcher.mock.calls[0][1]?.redirect).toBe('manual');
		expect(response?.headers.get('content-type')).toBe('image/gif');
		expect(await response?.text()).toBe('GIF89a');
	});

	it('refuses other hosts, other content and huge files', async () => {
		const html = vi.fn(
			async () => new Response('<script>', { headers: { 'content-type': 'text/html' } })
		);
		const huge = vi.fn(
			async () =>
				new Response('x', {
					headers: { 'content-type': 'image/gif', 'content-length': String(MAX_GIF_SIZE + 1) }
				})
		);
		const redirect = vi.fn(
			async () => new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/' } })
		);
		expect(await fetchGif('https://evil.example/a.gif', html)).toBeNull();
		expect(html).not.toHaveBeenCalled();
		expect(await fetchGif(gif, html)).toBeNull();
		expect(await fetchGif(gif, huge)).toBeNull();
		expect(await fetchGif(gif, redirect)).toBeNull();
	});
});

describe('checkGiphyKey', () => {
	it('tells working, refused and unreachable keys apart', async () => {
		const ok = vi.fn<typeof fetch>(async () => Response.json({ data: [] }));
		expect(await checkGiphyKey('key', ok)).toBe('ok');
		expect(new URL(String(ok.mock.calls[0][0])).searchParams.get('api_key')).toBe('key');
		expect(await checkGiphyKey('key', async () => new Response('', { status: 401 }))).toBe(
			'invalid'
		);
		expect(await checkGiphyKey('key', async () => new Response('', { status: 500 }))).toBe(
			'unreachable'
		);
		expect(
			await checkGiphyKey('key', async () => {
				throw new Error('offline');
			})
		).toBe('unreachable');
	});
});
