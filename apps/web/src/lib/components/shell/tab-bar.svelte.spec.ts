import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TabBar from './tab-bar.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/channels') } }));
vi.mock('$app/paths', () => ({
	resolve: (route: string) => route.replace('/(app)', '') || '/'
}));

describe('TabBar', () => {
	it('shows the Home tab and a tab for the instance', async () => {
		render(TabBar, { instanceName: "Lukas's Lumio" });

		await expect.element(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
		await expect
			.element(page.getByRole('link', { name: "Lukas's Lumio" }))
			.toHaveAttribute('href', '/channels');
	});

	it('marks the instance tab as active on channel pages', async () => {
		render(TabBar, { instanceName: 'Gaming' });

		const active = /(^|\s)bg-background(\s|$)/;
		await expect.element(page.getByRole('link', { name: 'Gaming' })).toHaveClass(active);
		await expect.element(page.getByRole('link', { name: 'Home' })).not.toHaveClass(active);
	});
});
