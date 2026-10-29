import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ReactionBar from './reaction-bar.svelte';

const reactions = [
	{
		emoji: '👍',
		users: [
			{ id: 'anna', name: 'Anna' },
			{ id: 'me', name: 'Lukas' }
		]
	},
	{ emoji: '🎉', users: [{ id: 'anna', name: 'Anna' }] }
];

describe('ReactionBar', () => {
	it('shows counts, marks own reactions and toggles on click', async () => {
		const ontoggle = vi.fn();
		render(ReactionBar, { reactions, meId: 'me', canReact: true, ontoggle });

		const thumbs = page.getByRole('button', { name: '👍 2' });
		await expect.element(thumbs).toHaveAttribute('aria-pressed', 'true');
		await thumbs.hover();
		await expect.element(page.getByText('Anna and You reacted with 👍')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: '🎉 1' }))
			.toHaveAttribute('aria-pressed', 'false');

		await page.getByRole('button', { name: '🎉 1' }).click();
		expect(ontoggle).toHaveBeenCalledWith('🎉');
	});

	it('only shows counts to users who may not react', async () => {
		render(ReactionBar, { reactions, meId: 'me', canReact: false, ontoggle: () => {} });
		await expect.element(page.getByRole('button', { name: '👍 2' })).toBeDisabled();
	});
});
