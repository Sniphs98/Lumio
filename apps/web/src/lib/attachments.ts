/** Shared file sharing rules, used on the server and in the browser. */

/** Default for the largest file members may upload (2 GiB). The owner can change it. */
export const DEFAULT_MAX_UPLOAD_SIZE = 2 * 1024 ** 3;
/** Bounds for the owner's setting: 1 MiB to 100 GiB. */
export const MIN_UPLOAD_SIZE_LIMIT = 1024 ** 2;
export const MAX_UPLOAD_SIZE_LIMIT = 100 * 1024 ** 3;

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/**
 * Size of each upload request. Large files are sent in pieces of this size, so an interrupted
 * upload resumes from the last piece. The server's `BODY_SIZE_LIMIT` must be above it.
 */
export const UPLOAD_CHUNK_SIZE = 8 * 1024 ** 2;

export type Attachment = {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
};

export type PreviewKind = 'image' | 'video' | 'audio' | 'file';

/**
 * Types the browser may show inline. Everything else is served as a download, so an uploaded
 * HTML or SVG file can never run script on the app's origin.
 */
const INLINE_TYPES: Record<string, Exclude<PreviewKind, 'file'>> = {
	'image/png': 'image',
	'image/jpeg': 'image',
	'image/gif': 'image',
	'image/webp': 'image',
	'image/avif': 'image',
	'video/mp4': 'video',
	'video/webm': 'video',
	'video/ogg': 'video',
	'video/quicktime': 'video',
	'audio/mpeg': 'audio',
	'audio/mp4': 'audio',
	'audio/ogg': 'audio',
	'audio/wav': 'audio',
	'audio/webm': 'audio',
	'audio/flac': 'audio'
};

export function previewKind(mimeType: string): PreviewKind {
	return INLINE_TYPES[mimeType] ?? 'file';
}

/** Turns a browser-supplied file name into a safe display name: no paths, no control characters. */
export function sanitizeFileName(raw: unknown): string {
	if (typeof raw !== 'string') return 'file';
	const base = raw.split(/[/\\]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
	const name = cleaned === '' || cleaned === '.' || cleaned === '..' ? 'file' : cleaned;
	return name.length > 200 ? name.slice(0, 200) : name;
}

/** Accepts a `type/subtype` MIME type, falling back to a generic binary type. */
export function sanitizeMimeType(raw: unknown): string {
	if (typeof raw !== 'string') return 'application/octet-stream';
	const type = raw.split(';')[0].trim().toLowerCase();
	return /^[a-z0-9][\w.+-]*\/[a-z0-9][\w.+-]*$/.test(type) && type.length <= 100
		? type
		: 'application/octet-stream';
}

export type UploadTarget = { channelId: string } | { conversationId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uploads name the chat they are for as `channel:<id>` or `conversation:<id>`. */
export function formatUploadTarget(target: UploadTarget): string {
	return 'channelId' in target
		? `channel:${target.channelId}`
		: `conversation:${target.conversationId}`;
}

export function parseUploadTarget(raw: unknown): UploadTarget | null {
	if (typeof raw !== 'string') return null;
	const [kind, id] = raw.split(':');
	if (!id || !UUID.test(id)) return null;
	if (kind === 'channel') return { channelId: id };
	if (kind === 'conversation') return { conversationId: id };
	return null;
}

/** Reads the attachment ids of the "send message" form. */
export function parseAttachmentIds(
	values: unknown[]
): { ok: true; ids: string[] } | { ok: false; error: string } {
	const ids = [...new Set(values)];
	if (ids.some((v) => typeof v !== 'string' || !UUID.test(v))) {
		return { ok: false, error: 'An attachment is invalid.' };
	}
	if (ids.length > MAX_ATTACHMENTS_PER_MESSAGE) {
		return { ok: false, error: `You can send up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at once.` };
	}
	return { ok: true, ids: ids as string[] };
}

/** Reads the "max upload size" setting, entered in MB. */
export function parseMaxUploadSize(
	raw: unknown
): { ok: true; bytes: number } | { ok: false; error: string } {
	const mb = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
	const bytes = Math.round(mb * 1024 ** 2);
	if (!Number.isFinite(bytes) || bytes < MIN_UPLOAD_SIZE_LIMIT || bytes > MAX_UPLOAD_SIZE_LIMIT) {
		return {
			ok: false,
			error: `Enter a size between ${formatBytes(MIN_UPLOAD_SIZE_LIMIT)} and ${formatBytes(MAX_UPLOAD_SIZE_LIMIT)}.`
		};
	}
	return { ok: true, bytes };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human-readable size with binary units, e.g. `1.5 MB` or `2 GB`. */
export function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	const rounded = unit === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
	return `${rounded} ${UNITS[unit]}`;
}

/**
 * Parses a `Range: bytes=…` request header for a file of `size` bytes. Only single ranges are
 * supported. Returns `null` when the whole file should be sent, `'invalid'` for a 416 response.
 */
export function parseRange(
	header: string | null,
	size: number
): { start: number; end: number } | null | 'invalid' {
	if (!header) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match) return null;
	const [, from, to] = match;
	let start: number;
	let end: number;
	if (from === '') {
		if (to === '') return 'invalid';
		// Suffix range: the last N bytes.
		start = Math.max(0, size - Number(to));
		end = size - 1;
	} else {
		start = Number(from);
		end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
	}
	if (start >= size || start > end) return 'invalid';
	return { start, end };
}
