import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import UnreadBadge from './unread-badge.svelte';

describe('UnreadBadge', () => {
	it('shows the number of unread messages', async () => {
		await render(UnreadBadge, { unread: { count: 3, mentions: 0 } });
		const badge = page.getByRole('status');
		await expect.element(badge).toMatchTextContent('3');
		await expect.element(badge).toHaveAccessibleName('3 unread messages');
	});

	it('shows mentions instead, and caps large numbers', async () => {
		await render(UnreadBadge, { unread: { count: 250, mentions: 120 } });
		const badge = page.getByRole('status');
		await expect.element(badge).toMatchTextContent('@99+');
		await expect.element(badge).toHaveAccessibleName('250 unread messages, 120 mentions');
	});

	it('explains itself in a tooltip on hover without becoming a tab stop', async () => {
		await render(UnreadBadge, { unread: { count: 3, mentions: 0 } });
		const badge = page.getByRole('status');
		await expect.element(badge).toHaveAttribute('tabindex', '-1');

		await badge.hover();
		await expect.element(page.getByText('3 unread messages', { exact: true })).toBeVisible();
	});

	it('shows nothing without unread messages', async () => {
		await render(UnreadBadge, { unread: { count: 0, mentions: 0 } });
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
