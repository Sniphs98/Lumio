import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PictureForm from './picture-form.svelte';

// A 1×1 PNG.
const picture =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const props = {
	uploadAction: '?/picture',
	removeAction: '?/removePicture',
	name: 'Anna',
	label: 'profile picture'
};

describe('PictureForm', () => {
	it('offers to upload a picture while there is none', async () => {
		await render(PictureForm, { ...props, image: null });

		await expect.element(page.getByRole('button', { name: 'Upload picture' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Remove profile picture' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByText('A', { exact: true })).toBeVisible();
	});

	it('shows the picture with buttons to change and remove it', async () => {
		const screen = await render(PictureForm, { ...props, image: picture });

		await expect.element(page.getByRole('button', { name: 'Change picture' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Remove profile picture' }))
			.toBeVisible();
		await expect.poll(() => screen.container.querySelector('img')?.src).toBe(picture);
	});

	it('only accepts picture formats', async () => {
		await render(PictureForm, { ...props, image: null });

		await expect
			.element(page.getByLabelText('Choose a profile picture'))
			.toHaveAttribute('accept', 'image/png,image/jpeg,image/gif,image/webp');
	});
});
