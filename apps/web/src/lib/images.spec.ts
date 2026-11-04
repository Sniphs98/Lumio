import { describe, expect, it } from 'vitest';
import {
	centerSquare,
	checkImage,
	imageIdFromUrl,
	imageUrl,
	MAX_IMAGE_SIZE,
	sniffImageType
} from './images.ts';

const id = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const gif = new TextEncoder().encode('GIF89a....');
const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');

describe('imageUrl and imageIdFromUrl', () => {
	it('round-trips the id of a stored picture', () => {
		expect(imageIdFromUrl(imageUrl(id))).toBe(id);
	});

	it('ignores other addresses', () => {
		expect(imageIdFromUrl(null)).toBeNull();
		expect(imageIdFromUrl('https://example.com/a.png')).toBeNull();
		expect(imageIdFromUrl('/api/images/../attachments/x')).toBeNull();
		expect(imageIdFromUrl(`/api/images/${id}/x`)).toBeNull();
	});
});

describe('sniffImageType', () => {
	it('recognizes the supported formats by their first bytes', () => {
		expect(sniffImageType(png)).toBe('image/png');
		expect(sniffImageType(jpeg)).toBe('image/jpeg');
		expect(sniffImageType(gif)).toBe('image/gif');
		expect(sniffImageType(webp)).toBe('image/webp');
	});

	it('rejects anything else, including SVG and other RIFF files', () => {
		expect(
			sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))
		).toBe(null);
		expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
		expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
	});
});

describe('checkImage', () => {
	it('accepts a supported picture', () => {
		expect(checkImage(png)).toEqual({ ok: true, type: 'image/png' });
	});

	it('asks for a picture when there is none', () => {
		expect(checkImage(null).ok).toBe(false);
		expect(checkImage(new Uint8Array()).ok).toBe(false);
	});

	it('rejects pictures that are too large', () => {
		const large = new Uint8Array(MAX_IMAGE_SIZE + 1);
		large.set(png);
		expect(checkImage(large)).toMatchObject({ ok: false, error: expect.stringContaining('8 MB') });
	});

	it('rejects other files', () => {
		expect(checkImage(new TextEncoder().encode('hello'))).toMatchObject({ ok: false });
	});
});

describe('centerSquare', () => {
	it('keeps the middle of wide and tall pictures', () => {
		expect(centerSquare(400, 200)).toEqual({ x: 100, y: 0, size: 200 });
		expect(centerSquare(200, 400)).toEqual({ x: 0, y: 100, size: 200 });
		expect(centerSquare(300, 300)).toEqual({ x: 0, y: 0, size: 300 });
	});
});
