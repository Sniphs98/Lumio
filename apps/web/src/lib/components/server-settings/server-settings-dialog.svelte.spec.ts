import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ServerSettingsDialog, { type ServerSettings } from './server-settings-dialog.svelte';

const general: NonNullable<ServerSettings['general']> = {
	name: 'Game night',
	isPublic: false,
	maxUploadSize: 2 * 1024 ** 3,
	quotas: { enabled: true, member: 5 * 1024 ** 3, guest: 1024 ** 3 }
};

const bans: NonNullable<ServerSettings['bans']> = [
	{ userId: 'u1', name: 'Troll', reason: 'Spam', createdAt: new Date('2026-10-01') }
];

describe('ServerSettingsDialog', () => {
	it('opens on the overview next to the section list', async () => {
		render(ServerSettingsDialog, { open: true, settings: { general, bans } });
		const nav = page.getByRole('navigation', { name: 'Server settings sections' });
		await expect
			.element(nav.getByRole('button', { name: 'Overview' }))
			.toHaveAttribute('aria-current', 'page');
		await expect.element(nav.getByRole('button', { name: 'Files & storage' })).toBeVisible();
		await expect.element(nav.getByRole('button', { name: 'Bans' })).toBeVisible();
		await expect.element(page.getByLabelText('Name', { exact: true })).toHaveValue('Game night');
		await expect
			.element(page.getByRole('switch', { name: 'Public server: guests can invite people' }))
			.not.toBeChecked();
	});

	it('switches to the file limits', async () => {
		render(ServerSettingsDialog, { open: true, settings: { general, bans } });
		await page.getByRole('button', { name: 'Files & storage' }).click();
		await expect.element(page.getByRole('heading', { name: 'Files & storage' })).toBeVisible();
		await expect.element(page.getByLabelText('Largest file (MB)')).toHaveValue(2048);
		await expect.element(page.getByLabelText('Members (GB)')).toHaveValue(5);
	});

	it('lists the bans', async () => {
		render(ServerSettingsDialog, { open: true, section: 'bans', settings: { general, bans } });
		const list = page.getByRole('region', { name: 'Banned' });
		await expect.element(list.getByRole('listitem')).toHaveTextContent(/Troll.*Spam/);
		await expect.element(list.getByRole('button', { name: 'Unban' })).toBeVisible();
	});

	it('only shows moderators the bans', async () => {
		render(ServerSettingsDialog, { open: true, settings: { general: null, bans: [] } });
		const nav = page.getByRole('navigation', { name: 'Server settings sections' });
		await expect.element(nav.getByRole('button', { name: 'Bans' })).toBeVisible();
		await expect.element(nav.getByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
		await expect.element(page.getByText('Nobody is banned.')).toBeVisible();
	});
});
