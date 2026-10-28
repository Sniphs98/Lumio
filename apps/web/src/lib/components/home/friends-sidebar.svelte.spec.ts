import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FriendsSidebar from './friends-sidebar.svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\/\([^)]+\)/g, '').replace(/\[(\w+)\]/g, (_, key: string) => params[key]) || '/'
}));

const ben = { id: 'ben', name: 'Ben', image: null };
const cleo = { id: 'cleo', name: 'Cleo', image: null };
const dave = { id: 'dave', name: 'Dave', image: null };

const empty = { friends: [], incoming: [], outgoing: [], groups: [], directConversationIds: {} };

describe('FriendsSidebar', () => {
	it('shows empty friends and groups lists', async () => {
		render(FriendsSidebar, empty);

		await expect.element(page.getByText('No friends added yet.')).toBeVisible();
		await expect.element(page.getByText('No group chats yet.')).toBeVisible();
		await expect.element(page.getByText('Friend requests')).not.toBeInTheDocument();
	});

	it('links friends to their direct messages and marks the open one', async () => {
		render(FriendsSidebar, {
			...empty,
			friends: [ben, cleo],
			directConversationIds: { ben: 'c-ben' },
			activeConversationId: 'c-ben'
		});

		const benLink = page.getByRole('link', { name: 'Ben' });
		await expect.element(benLink).toHaveAttribute('href', '/friends/ben');
		await expect.element(benLink).toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Cleo' }))
			.not.toHaveAttribute('aria-current');
	});

	it('offers accept and decline for incoming requests and cancel for sent ones', async () => {
		render(FriendsSidebar, { ...empty, incoming: [cleo], outgoing: [dave] });

		await expect.element(page.getByRole('button', { name: 'Accept Cleo' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Decline Cleo' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Cancel request to Dave' }))
			.toBeVisible();
	});

	it('lists groups separately from friends', async () => {
		render(FriendsSidebar, {
			...empty,
			friends: [ben],
			groups: [{ id: 'g1', name: 'Raid night' }]
		});

		await expect
			.element(page.getByRole('link', { name: 'Raid night' }))
			.toHaveAttribute('href', '/dm/g1');
	});

	it('shows the result of the last friend action', async () => {
		render(FriendsSidebar, { ...empty, error: 'You cannot add yourself.' });
		await expect.element(page.getByRole('alert')).toHaveTextContent('You cannot add yourself.');
	});
});
