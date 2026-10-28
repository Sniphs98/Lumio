import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FriendPicker from './friend-picker.svelte';

const friends = [
	{ id: 'ben', name: 'Ben', image: null },
	{ id: 'cleo', name: 'Cleo', image: null }
];

describe('FriendPicker', () => {
	it('sends the ids of the picked friends with the form', async () => {
		const { container } = render(FriendPicker, { friends, label: 'Friends to add' });

		await expect.element(page.getByRole('list', { name: 'Friends to add' })).toBeVisible();
		await page.getByText('Cleo').click();
		await expect.element(page.getByRole('checkbox', { name: 'Cleo' })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: 'Ben' })).not.toBeChecked();

		const form = document.createElement('form');
		form.append(...container.childNodes);
		expect(new FormData(form).getAll('userId')).toEqual(['cleo']);
	});
});
