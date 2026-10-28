import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import InviteList from './invite-list.svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));

const invite = {
	code: 'abc123',
	url: 'https://lumio.example/invite/abc123',
	createdByName: 'Anna',
	uses: 2,
	maxUses: 5,
	expiresAt: null,
	canRevoke: true
};

describe('InviteList', () => {
	it('shows an empty state', async () => {
		render(InviteList, { invites: [], showCreator: false });
		await expect.element(page.getByText('No active invite links.')).toBeVisible();
	});

	it('shows the link with its uses and expiry', async () => {
		render(InviteList, { invites: [invite], showCreator: false });

		await expect.element(page.getByText(invite.url)).toBeVisible();
		await expect.element(page.getByText('2 of 5 used · Never expires')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Copy invite link abc123' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Revoke invite link abc123' }))
			.toBeVisible();
	});

	it('names the creator for admins and hides revoke where it is not allowed', async () => {
		render(InviteList, { invites: [{ ...invite, canRevoke: false }], showCreator: true });

		await expect.element(page.getByText('Anna · 2 of 5 used · Never expires')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Revoke invite link abc123' }))
			.not.toBeInTheDocument();
	});
});
