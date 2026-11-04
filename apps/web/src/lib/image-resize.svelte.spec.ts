import { describe, expect, it } from 'vitest';
import { prepareImage } from './image-resize.ts';

async function pictureFile(width: number, height: number, type = 'image/png'): Promise<File> {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d')!;
	context.fillStyle = '#3b82f6';
	context.fillRect(0, 0, width, height);
	const blob = await canvas.convertToBlob({ type });
	return new File([blob], 'photo.png', { type });
}

// Runs in the browser project: it needs a canvas and image decoding.
describe('prepareImage', () => {
	it('crops large pictures to a square and scales them down', async () => {
		const prepared = await prepareImage(await pictureFile(2000, 1000));
		const bitmap = await createImageBitmap(prepared);
		expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
		expect(prepared.type).toBe('image/webp');
	});

	it('does not scale small pictures up', async () => {
		const bitmap = await createImageBitmap(await prepareImage(await pictureFile(100, 300)));
		expect([bitmap.width, bitmap.height]).toEqual([100, 100]);
	});

	it('keeps GIFs and files it cannot read as they are', async () => {
		const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], 'a.gif', {
			type: 'image/gif'
		});
		expect(await prepareImage(gif)).toBe(gif);
		const text = new File(['hello'], 'a.png', { type: 'image/png' });
		expect(await prepareImage(text)).toBe(text);
	});
});
