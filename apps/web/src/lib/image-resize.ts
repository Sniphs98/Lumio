import { centerSquare, IMAGE_DIMENSION } from '#lib/images.ts';

/**
 * Prepares a picture for uploading in the browser: crops it to a square from its middle and scales
 * it down to `IMAGE_DIMENSION`, so it stays small. GIFs are sent as they are to keep their
 * animation. Files the browser cannot decode are sent unchanged; the server rejects them.
 */
export async function prepareImage(file: File): Promise<File> {
	if (file.type === 'image/gif') return file;
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file;
	}
	const { x, y, size } = centerSquare(bitmap.width, bitmap.height);
	const target = Math.min(IMAGE_DIMENSION, size);
	const canvas = document.createElement('canvas');
	canvas.width = target;
	canvas.height = target;
	const context = canvas.getContext('2d');
	if (!context) {
		bitmap.close();
		return file;
	}
	context.imageSmoothingQuality = 'high';
	context.drawImage(bitmap, x, y, size, size, 0, 0, target, target);
	bitmap.close();

	// Browsers without WebP encoding (older Safari) fall back to PNG.
	const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.9));
	if (!blob) return file;
	const extension = blob.type === 'image/webp' ? 'webp' : 'png';
	return new File([blob], `picture.${extension}`, { type: blob.type });
}
