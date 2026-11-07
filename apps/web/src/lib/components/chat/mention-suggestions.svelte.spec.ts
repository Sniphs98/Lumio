import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MentionSuggestions from './mention-suggestions.svelte';

const ben = { id: 'ben', name: 'Ben', image: null };
const cleo = { id: 'cleo', name: 'Cleo', image: null };

describe('MentionSuggestions', () => {
	it('lists the people to mention and highlights the active one', async () => {
		await render(MentionSuggestions, {
			id: 'mentions',
			users: [ben, cleo],
			active: 1,
			onpick: vi.fn()
		});

		const list = page.getByRole('listbox', { name: 'Mention someone' });
		await expect.element(list).toHaveAttribute('id', 'mentions');
		await expect
			.element(list.getByRole('option', { name: 'Cleo' }))
			.toHaveAttribute('aria-selected', 'true');
		await expect
			.element(list.getByRole('option', { name: 'Ben' }))
			.not.toHaveAttribute('aria-selected', 'true');
	});

	it('picks a person on click without taking the focus from the composer', async () => {
		const onpick = vi.fn();
		const composer = document.createElement('textarea');
		document.body.append(composer);
		composer.focus();
		await render(MentionSuggestions, { id: 'mentions', users: [ben, cleo], active: 0, onpick });

		await page.getByRole('option', { name: 'Cleo' }).click();

		expect(onpick).toHaveBeenCalledWith(cleo);
		expect(document.activeElement).toBe(composer);
		composer.remove();
	});

	it('highlights a person on hover', async () => {
		const onactive = vi.fn();
		await render(MentionSuggestions, {
			id: 'mentions',
			users: [ben, cleo],
			active: 0,
			onactive,
			onpick: vi.fn()
		});

		await page.getByRole('option', { name: 'Cleo' }).hover();

		expect(onactive).toHaveBeenCalledWith(1);
	});
});
