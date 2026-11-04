/**
 * Pictures: profile pictures, the server icon and group chat pictures. Shared rules, used on the
 * server and in the browser.
 */

/** Largest picture the server accepts. Browsers scale pictures down before uploading them. */
export const MAX_IMAGE_SIZE = 8 * 1024 ** 2;

/** Width and height pictures are scaled down to in the browser. */
export const IMAGE_DIMENSION = 512;

/** Formats a picture may have. No SVG: it can carry script. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** For the `accept` attribute of file inputs. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

const IMAGE_PATH = '/api/images/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a stored picture is served. This address is saved wherever the picture is used. */
export function imageUrl(id: string): string {
	return `${IMAGE_PATH}${id}`;
}

/** The id of a picture stored by Lumio, or null for any other address (or none). */
export function imageIdFromUrl(url: string | null | undefined): string | null {
	if (!url?.startsWith(IMAGE_PATH)) return null;
	const id = url.slice(IMAGE_PATH.length);
	return UUID.test(id) ? id : null;
}

export function isImageId(id: string): boolean {
	return UUID.test(id);
}

/**
 * The real format of a picture, read from its first bytes, or null when it is none of
 * `IMAGE_TYPES`. The type a browser claims for a file is not trusted.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
	const starts = (signature: number[], offset = 0) =>
		bytes.length >= offset + signature.length &&
		signature.every((byte, i) => bytes[offset + i] === byte);

	if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
	// "RIFF", four bytes of size, "WEBP"
	if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
	return null;
}

export type ImageCheck = { ok: true; type: ImageType } | { ok: false; error: string };

/** Checks an uploaded picture: present, not too large and in a supported format. */
export function checkImage(bytes: Uint8Array | null): ImageCheck {
	if (!bytes || bytes.length === 0) return { ok: false, error: 'Pick a picture to upload.' };
	if (bytes.length > MAX_IMAGE_SIZE) {
		return { ok: false, error: 'This picture is too large. Pick one of at most 8 MB.' };
	}
	const type = sniffImageType(bytes);
	if (!type) return { ok: false, error: 'Pick a PNG, JPEG, GIF or WebP picture.' };
	return { ok: true, type };
}

/**
 * The square part of a `width` × `height` picture that is kept when it is cropped to a square:
 * the middle of it.
 */
export function centerSquare(width: number, height: number) {
	const size = Math.min(width, height);
	return { x: (width - size) / 2, y: (height - size) / 2, size };
}
