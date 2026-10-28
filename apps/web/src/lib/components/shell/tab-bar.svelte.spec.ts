import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TabBar from './tab-bar.svelte';

const state = vi.hoisted(() => ({ page: { url: new URL('http://localhost/channels') } }));
vi.mock('$app/state', () => state);
vi.mock('$app/paths', () => ({
	resolve: (route: string) => route.replace(/\/\([^)]+\)/g, '') || '/'
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

	it('keeps the Home tab active in direct messages', async () => {
		state.page.url = new URL('http://localhost/dm/c1');
		render(TabBar, { instanceName: 'Gaming' });

		const active = /(^|\s)bg-background(\s|$)/;
		await expect.element(page.getByRole('link', { name: 'Home' })).toHaveClass(active);
		await expect.element(page.getByRole('link', { name: 'Gaming' })).not.toHaveClass(active);
	});

	it('offers guests to create an account on every page', async () => {
		render(TabBar, { instanceName: 'Gaming', isGuest: true });
		await expect
			.element(page.getByRole('link', { name: 'Guest · Create account' }))
			.toHaveAttribute('href', '/account');
	});

	it('shows no account link to members', async () => {
		render(TabBar, { instanceName: 'Gaming' });
		await expect
			.element(page.getByRole('link', { name: 'Guest · Create account' }))
			.not.toBeInTheDocument();
	});
});
