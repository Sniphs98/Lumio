import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_AUDIO_SETTINGS } from '#lib/audio-settings.ts';
import type { AudioControls } from '#lib/call.svelte.ts';
import UserPanel from './user-panel.svelte';

vi.mock('$app/paths', () => ({
	resolve: (route: string) => route.replace(/\/\([^)]+\)/g, '') || '/'
}));

function fakeAudio(overrides: Partial<AudioControls> = {}): AudioControls {
	return {
		muted: false,
		deafened: false,
		settings: { ...DEFAULT_AUDIO_SETTINGS },
		outputSelectionSupported: true,
		toggleMute: vi.fn(async () => {}),
		toggleDeafen: vi.fn(),
		updateSettings: vi.fn(async () => {}),
		...overrides
	};
}

const user = { name: 'anna', image: null, isGuest: false };

describe('UserPanel', () => {
	it('shows who is signed in and links to the account', async () => {
		render(UserPanel, { user, audio: fakeAudio() });
		const panel = page.getByRole('region', { name: 'You' });
		await expect
			.element(panel.getByRole('link', { name: /anna/ }))
			.toHaveAttribute('href', '/account');
		await expect.element(panel).toHaveTextContent('Online');
	});

	it('mutes and deafens', async () => {
		const audio = fakeAudio();
		render(UserPanel, { user, audio });
		await page.getByRole('button', { name: 'Mute' }).click();
		await page.getByRole('button', { name: 'Deafen' }).click();
		expect(audio.toggleMute).toHaveBeenCalledOnce();
		expect(audio.toggleDeafen).toHaveBeenCalledOnce();
	});

	it('shows when muted or deafened', async () => {
		render(UserPanel, { user, audio: fakeAudio({ muted: true, deafened: true }) });
		await expect
			.element(page.getByRole('button', { name: 'Unmute' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Undeafen' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect.element(page.getByRole('region', { name: 'You' })).toHaveTextContent('Deafened');
	});

	it('opens the settings on Audio & Mic', async () => {
		render(UserPanel, { user, audio: fakeAudio() });
		await page.getByRole('button', { name: 'Settings' }).click();
		const dialog = page.getByRole('dialog', { name: 'Settings' });
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog.getByRole('heading', { name: 'Audio & Mic' })).toBeVisible();
	});
});
