import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ServerSettingsDialog, { type ServerSettings } from './server-settings-dialog.svelte';

const general: NonNullable<ServerSettings['general']> = {
	iconUrl: null,
	name: 'Game night',
	isPublic: false,
	maxUploadSize: 2 * 1024 ** 3,
	quotas: { enabled: true, member: 5 * 1024 ** 3, guest: 1024 ** 3 },
	gifs: { hasKey: false, fromEnv: false }
};

const bans: NonNullable<ServerSettings['bans']> = [
	{ userId: 'u1', name: 'Troll', reason: 'Spam', createdAt: new Date('2026-10-01') }
];

describe('ServerSettingsDialog', () => {
	it('opens on the overview next to the section list', async () => {
		await render(ServerSettingsDialog, { open: true, settings: { general, bans } });
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
		await render(ServerSettingsDialog, { open: true, settings: { general, bans } });
		await page.getByRole('button', { name: 'Files & storage' }).click();
		await expect.element(page.getByRole('heading', { name: 'Files & storage' })).toBeVisible();
		await expect.element(page.getByLabelText('Largest file (MB)')).toHaveValue(2048);
		await expect.element(page.getByLabelText('Members (GB)')).toHaveValue(5);
	});

	it('lets the owner paste a GIPHY key, unless the server sets one', async () => {
		await render(ServerSettingsDialog, {
			open: true,
			section: 'chat',
			settings: { general, bans }
		});
		await expect.element(page.getByLabelText('GIPHY API key')).toHaveAttribute('type', 'password');
		await expect
			.element(page.getByRole('link', { name: 'GIPHY developer dashboard' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Turn off GIFs' }))
			.not.toBeInTheDocument();
	});

	it('only offers turning GIFs off once a key is saved, and hides the form for server keys', async () => {
		const withKey = { ...general, gifs: { hasKey: true, fromEnv: false } };
		const { unmount } = await render(ServerSettingsDialog, {
			open: true,
			section: 'chat',
			settings: { general: withKey, bans }
		});
		await expect.element(page.getByRole('button', { name: 'Turn off GIFs' })).toBeVisible();
		unmount();

		const fromEnv = { ...general, gifs: { hasKey: true, fromEnv: true } };
		await render(ServerSettingsDialog, {
			open: true,
			section: 'chat',
			settings: { general: fromEnv, bans }
		});
		await expect.element(page.getByText(/environment variable/)).toBeVisible();
		await expect.element(page.getByLabelText('GIPHY API key')).not.toBeInTheDocument();
	});

	it('lists the bans', async () => {
		await render(ServerSettingsDialog, {
			open: true,
			section: 'bans',
			settings: { general, bans }
		});
		const list = page.getByRole('region', { name: 'Banned' });
		await expect.element(list.getByRole('listitem')).toMatchTextContent(/Troll.*Spam/);
		await expect.element(list.getByRole('button', { name: 'Unban' })).toBeVisible();
	});

	it('only shows moderators the bans', async () => {
		await render(ServerSettingsDialog, { open: true, settings: { general: null, bans: [] } });
		const nav = page.getByRole('navigation', { name: 'Server settings sections' });
		await expect.element(nav.getByRole('button', { name: 'Bans' })).toBeVisible();
		await expect.element(nav.getByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
		await expect.element(page.getByText('Nobody is banned.')).toBeVisible();
	});
});
