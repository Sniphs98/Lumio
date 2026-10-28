import { describe, expect, it } from 'vitest';
import {
	formatBytes,
	formatUploadTarget,
	MAX_ATTACHMENTS_PER_MESSAGE,
	parseAttachmentIds,
	parseMaxUploadSize,
	parseRange,
	parseUploadTarget,
	previewKind,
	sanitizeFileName,
	sanitizeMimeType
} from './attachments.ts';

const id = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';

describe('previewKind', () => {
	it('shows images, videos and audio inline', () => {
		expect(previewKind('image/png')).toBe('image');
		expect(previewKind('video/mp4')).toBe('video');
		expect(previewKind('audio/mpeg')).toBe('audio');
	});

	it('treats types that can run script as plain downloads', () => {
		expect(previewKind('image/svg+xml')).toBe('file');
		expect(previewKind('text/html')).toBe('file');
		expect(previewKind('application/pdf')).toBe('file');
	});
});

describe('sanitizeFileName', () => {
	it('keeps only the base name without control characters', () => {
		expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
		expect(sanitizeFileName('C:\\Users\\me\\photo.jpg')).toBe('photo.jpg');
		expect(sanitizeFileName('a\u0000b\nc.txt')).toBe('abc.txt');
	});

	it('falls back to a generic name', () => {
		expect(sanitizeFileName(undefined)).toBe('file');
		expect(sanitizeFileName('  ')).toBe('file');
		expect(sanitizeFileName('..')).toBe('file');
	});

	it('shortens very long names', () => {
		expect(sanitizeFileName('a'.repeat(300))).toHaveLength(200);
	});
});

describe('sanitizeMimeType', () => {
	it('accepts valid types and drops parameters', () => {
		expect(sanitizeMimeType('Image/PNG')).toBe('image/png');
		expect(sanitizeMimeType('text/plain; charset=utf-8')).toBe('text/plain');
	});

	it('falls back to a binary type', () => {
		expect(sanitizeMimeType('')).toBe('application/octet-stream');
		expect(sanitizeMimeType('not a type')).toBe('application/octet-stream');
		expect(sanitizeMimeType(null)).toBe('application/octet-stream');
	});
});

describe('upload targets', () => {
	it('round-trips channels and conversations', () => {
		expect(parseUploadTarget(formatUploadTarget({ channelId: id }))).toEqual({ channelId: id });
		expect(parseUploadTarget(formatUploadTarget({ conversationId: id }))).toEqual({
			conversationId: id
		});
	});

	it('rejects unknown kinds and ids', () => {
		expect(parseUploadTarget(`server:${id}`)).toBeNull();
		expect(parseUploadTarget('channel:general')).toBeNull();
		expect(parseUploadTarget(undefined)).toBeNull();
	});
});

describe('parseAttachmentIds', () => {
	it('removes duplicates', () => {
		expect(parseAttachmentIds([id, id])).toEqual({ ok: true, ids: [id] });
		expect(parseAttachmentIds([])).toEqual({ ok: true, ids: [] });
	});

	it('rejects invalid ids and too many files', () => {
		expect(parseAttachmentIds(['nope']).ok).toBe(false);
		const many = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) =>
			id.replace(/.{2}$/, i.toString(16).padStart(2, '0'))
		);
		expect(parseAttachmentIds(many).ok).toBe(false);
	});
});

describe('parseMaxUploadSize', () => {
	it('reads megabytes', () => {
		expect(parseMaxUploadSize('2048')).toEqual({ ok: true, bytes: 2 * 1024 ** 3 });
		expect(parseMaxUploadSize('1')).toEqual({ ok: true, bytes: 1024 ** 2 });
	});

	it('rejects values outside the bounds', () => {
		expect(parseMaxUploadSize('0').ok).toBe(false);
		expect(parseMaxUploadSize('').ok).toBe(false);
		expect(parseMaxUploadSize('abc').ok).toBe(false);
		expect(parseMaxUploadSize(String(200 * 1024)).ok).toBe(false);
	});
});

describe('formatBytes', () => {
	it('uses readable units', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB');
		expect(formatBytes(150 * 1024 ** 2)).toBe('150 MB');
	});
});

describe('parseRange', () => {
	it('sends the whole file without a range', () => {
		expect(parseRange(null, 100)).toBeNull();
		expect(parseRange('items=0-1', 100)).toBeNull();
	});

	it('reads start, end, open and suffix ranges', () => {
		expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
		expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
		expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
		expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
	});

	it('rejects ranges outside the file', () => {
		expect(parseRange('bytes=100-', 100)).toBe('invalid');
		expect(parseRange('bytes=9-1', 100)).toBe('invalid');
		expect(parseRange('bytes=-', 100)).toBe('invalid');
	});
});
