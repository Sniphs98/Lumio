import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import UnreadBadge from './unread-badge.svelte';

describe('UnreadBadge', () => {
	it('shows the number of unread messages', async () => {
		render(UnreadBadge, { unread: { count: 3, mentions: 0 } });
		const badge = page.getByRole('status');
		await expect.element(badge).toHaveTextContent('3');
		await expect.element(badge).toHaveAccessibleName('3 unread messages');
	});

	it('shows mentions instead, and caps large numbers', async () => {
		render(UnreadBadge, { unread: { count: 250, mentions: 120 } });
		const badge = page.getByRole('status');
		await expect.element(badge).toHaveTextContent('@99+');
		await expect.element(badge).toHaveAccessibleName('250 unread messages, 120 mentions');
	});

	it('shows nothing without unread messages', async () => {
		render(UnreadBadge, { unread: { count: 0, mentions: 0 } });
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
