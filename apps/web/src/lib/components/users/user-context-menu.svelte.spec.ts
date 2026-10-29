import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { UserMenuAccess } from '#lib/user-menu.ts';
import Harness from './user-context-menu.test-harness.svelte';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\/\([^)]+\)/g, '').replace(/\[(\w+)\]/g, (_, key: string) => params[key]) || '/'
}));

const ben = { id: 'ben', name: 'Ben' };

const moderator: UserMenuAccess = {
	meId: 'me',
	friendIds: new Set(['ben']),
	members: new Map([['ben', { canKick: true, canBan: true, isGuest: false }]])
};

async function openMenu(name: string) {
	await page.getByRole('listitem').filter({ hasText: name }).click({ button: 'right' });
}

describe('UserContextMenu', () => {
	it('offers a message, kick and ban to a moderator', async () => {
		const onmoderate = vi.fn();
		render(Harness, { access: moderator, user: ben, onmoderate });

		await openMenu('Ben');
		const menu = page.getByRole('menu');
		await expect.element(menu.getByRole('menuitem', { name: 'Send message' })).toBeVisible();
		await expect.element(menu.getByRole('menuitem', { name: 'Kick' })).toBeVisible();
		await menu.getByRole('menuitem', { name: 'Ban' }).click();
		expect(onmoderate).toHaveBeenCalledWith('ban', ben);
	});

	it('opens the direct conversation with a friend', async () => {
		render(Harness, { access: moderator, user: ben });

		await openMenu('Ben');
		await page.getByRole('menuitem', { name: 'Send message' }).click();
		expect(goto).toHaveBeenCalledWith('/friends/ben');
	});

	it('hides moderation without permission', async () => {
		render(Harness, {
			access: { meId: 'me', friendIds: new Set(), members: new Map() },
			user: ben,
			onmention: () => {}
		});

		await openMenu('Ben');
		await expect.element(page.getByRole('menuitem', { name: 'Mention' })).toBeVisible();
		await expect.element(page.getByRole('menuitem', { name: 'Kick' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('menuitem', { name: 'Ban' })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: 'Send message' }))
			.not.toBeInTheDocument();
	});

	it('mentions someone outside a server', async () => {
		const onmention = vi.fn();
		render(Harness, { user: ben, onmention });

		await openMenu('Ben');
		await page.getByRole('menuitem', { name: 'Mention' }).click();
		expect(onmention).toHaveBeenCalled();
	});

	it('opens no menu when there is nothing to offer', async () => {
		render(Harness, { access: moderator, user: { id: 'me', name: 'Me' } });

		await openMenu('Me');
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
	});
});
