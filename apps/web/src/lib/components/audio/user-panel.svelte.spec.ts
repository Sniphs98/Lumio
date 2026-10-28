import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_AUDIO_SETTINGS } from '#lib/audio-settings.ts';
import type { AudioControls } from '#lib/call.svelte.ts';
import AudioSettingsDialog from './audio-settings-dialog.svelte';
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

	it('opens the audio settings', async () => {
		render(UserPanel, { user, audio: fakeAudio() });
		await page.getByRole('button', { name: 'Audio settings' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Audio settings' })).toBeVisible();
	});
});

describe('AudioSettingsDialog', () => {
	const listDevices = async () => [
		{ deviceId: 'mic-1', kind: 'audioinput' as const, label: 'Headset microphone' },
		{ deviceId: 'out-1', kind: 'audiooutput' as const, label: 'Headset' }
	];

	it('shows the chosen devices', async () => {
		render(AudioSettingsDialog, {
			open: true,
			listDevices,
			audio: fakeAudio({ settings: { ...DEFAULT_AUDIO_SETTINGS, inputDeviceId: 'mic-1' } })
		});
		await expect
			.element(page.getByLabelText('Microphone', { exact: true }))
			.toHaveTextContent('Headset microphone');
		await expect.element(page.getByLabelText('Speakers')).toHaveTextContent('Default');
	});

	it('picks another microphone', async () => {
		const audio = fakeAudio();
		render(AudioSettingsDialog, { open: true, listDevices, audio });
		await page.getByLabelText('Microphone', { exact: true }).click();
		await page.getByRole('option', { name: 'Headset microphone' }).click();
		expect(audio.updateSettings).toHaveBeenCalledWith({ inputDeviceId: 'mic-1' });
	});

	it('switches voice processing', async () => {
		const audio = fakeAudio();
		render(AudioSettingsDialog, { open: true, listDevices, audio });
		const noise = page.getByRole('switch', { name: 'Noise suppression' });
		await expect.element(noise).toBeChecked();
		await noise.click();
		expect(audio.updateSettings).toHaveBeenCalledWith({ noiseSuppression: false });
	});

	it('explains when the browser cannot pick speakers', async () => {
		render(AudioSettingsDialog, {
			open: true,
			listDevices,
			audio: fakeAudio({ outputSelectionSupported: false })
		});
		await expect.element(page.getByLabelText('Speakers')).toBeDisabled();
		await expect
			.element(page.getByText(/always plays through the system's speakers/))
			.toBeVisible();
	});
});
