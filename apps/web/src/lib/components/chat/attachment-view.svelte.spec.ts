import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AttachmentView from './attachment-view.svelte';

const file = (fileName: string, mimeType: string, size = 1536) => ({
	id: 'a1',
	fileName,
	mimeType,
	size
});

describe('AttachmentView', () => {
	it('shows images inline', async () => {
		render(AttachmentView, { attachment: file('cat.png', 'image/png') });
		await expect.element(page.getByRole('img', { name: 'cat.png' })).toBeInTheDocument();
	});

	it('shows videos with controls and a download link', async () => {
		const { container } = render(AttachmentView, { attachment: file('clip.mp4', 'video/mp4') });
		expect(container.querySelector('video[controls]')).not.toBeNull();
		await expect
			.element(page.getByRole('link', { name: 'Download clip.mp4' }))
			.toHaveAttribute('download', 'clip.mp4');
	});

	it('shows other files as a download with their size', async () => {
		render(AttachmentView, {
			attachment: file('notes.pdf', 'application/pdf', 3 * 1024 ** 2)
		});
		const link = page.getByRole('link', { name: 'Download notes.pdf' });
		await expect.element(link).toHaveTextContent('3 MB');
		await expect.element(link).toHaveAttribute('href', '/api/attachments/a1/notes.pdf');
	});

	it('encodes the file name in the link', async () => {
		render(AttachmentView, { attachment: file('my notes #1.txt', 'text/plain') });
		await expect
			.element(page.getByRole('link', { name: 'Download my notes #1.txt' }))
			.toHaveAttribute('href', '/api/attachments/a1/my%20notes%20%231.txt');
		expect(document.querySelector('img, video')).toBeNull();
	});
});
