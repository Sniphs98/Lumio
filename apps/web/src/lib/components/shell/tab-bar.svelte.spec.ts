import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TabBar from './tab-bar.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: { id: string }) =>
		route.replace('/(app)', '').replace('[id]', params?.id ?? '') || '/'
}));

describe('TabBar', () => {
	it('shows the Home tab and one tab per server', async () => {
		render(TabBar, {
			servers: [
				{ id: 'a', name: 'Gaming', iconUrl: null },
				{ id: 'b', name: 'Uni', iconUrl: null }
			]
		});

		await expect.element(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
		await expect
			.element(page.getByRole('link', { name: 'Gaming' }))
			.toHaveAttribute('href', '/s/a');
		await expect.element(page.getByRole('link', { name: 'Uni' })).toHaveAttribute('href', '/s/b');
	});
});
