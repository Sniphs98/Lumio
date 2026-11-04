import { describe, expect, it } from 'vitest';
import { gifInContent, gifMediaPath, isGifUrl, parseGiphyKey } from './gifs.ts';

describe('isGifUrl', () => {
	it('accepts files of Giphy and Tenor', () => {
		for (const url of [
			'https://media.giphy.com/media/abc/giphy.gif',
			'https://media3.giphy.com/media/v1.Y2lk/abc/200.webp',
			'https://i.giphy.com/abc.webp',
			'https://media.tenor.com/abc/cat.gif',
			'https://c.tenor.com/abc/cat.gif'
		]) {
			expect(isGifUrl(url)).toBe(true);
		}
	});

	it('rejects other hosts, plain HTTP and tricks', () => {
		for (const url of [
			'http://media.giphy.com/media/abc/giphy.gif',
			'https://giphy.com.evil.example/a.gif',
			'https://evil.example/media.giphy.com/a.gif',
			'https://user@media.giphy.com/a.gif',
			'https://media.giphy.com:8443/a.gif',
			'https://api.giphy.com/v1/gifs/trending',
			'https://localhost/a.gif',
			'not a url'
		]) {
			expect(isGifUrl(url)).toBe(false);
		}
	});
});

describe('gifInContent', () => {
	it('finds a message that is only a GIF address', () => {
		const url = 'https://media.tenor.com/abc/cat.gif';
		expect(gifInContent(` ${url}\n`)).toBe(url);
		expect(gifInContent(`look ${url}`)).toBeNull();
		expect(gifInContent('hello')).toBeNull();
	});

	it('loads GIFs through the proxy', () => {
		expect(gifMediaPath('https://media.tenor.com/a b.gif')).toBe(
			'/api/gifs/media?url=https%3A%2F%2Fmedia.tenor.com%2Fa%20b.gif'
		);
	});
});

describe('parseGiphyKey', () => {
	it('accepts a trimmed key and rejects anything else', () => {
		expect(parseGiphyKey('  AbCdEfGhIjKlMnOpQrStUvWxYz012345 ')).toEqual({
			ok: true,
			key: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'
		});
		for (const raw of [
			'',
			'   ',
			'short',
			'has spaces in the middle of it ok',
			'x'.repeat(65),
			null
		]) {
			expect(parseGiphyKey(raw).ok).toBe(false);
		}
	});
});
