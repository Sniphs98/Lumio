import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import EmojiPanel from './emoji-panel.svelte';

describe('EmojiPanel', () => {
	beforeEach(() => localStorage.clear());

	it('offers frequently used emojis and every category', async () => {
		const onpick = vi.fn();
		await render(EmojiPanel, { onpick });

		await page.getByRole('button', { name: 'thumbs up' }).click();
		expect(onpick).toHaveBeenCalledWith('👍');

		await page.getByRole('tab', { name: 'Food & drink' }).click();
		await page.getByRole('button', { name: 'pizza', exact: true }).click();
		expect(onpick).toHaveBeenLastCalledWith('🍕');
	});

	it('searches emojis and remembers the picked ones', async () => {
		const onpick = vi.fn();
		const { unmount } = await render(EmojiPanel, {
			onpick,
			actionLabel: (label: string) => `React with ${label}`
		});

		await page.getByLabelText('Search emojis').fill('taco');
		await page.getByRole('button', { name: 'React with taco' }).click();
		expect(onpick).toHaveBeenCalledWith('🌮');
		await page.getByLabelText('Search emojis').fill('qqqzzz');
		await expect.element(page.getByText('No emoji found.')).toBeVisible();
		unmount();

		// The next picker starts with the taco.
		await render(EmojiPanel, { onpick });
		const first = page.getByRole('group', { name: 'Frequently used' }).getByRole('button').first();
		await expect.element(first).toHaveAccessibleName('taco');
	});
});
