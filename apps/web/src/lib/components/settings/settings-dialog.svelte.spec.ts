import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { DEFAULT_AUDIO_SETTINGS } from '#lib/audio-settings.ts';
import type { AudioControls } from '#lib/call.svelte.ts';
import { sounds } from '#lib/sound-player.svelte.ts';
import SettingsDialog from './settings-dialog.svelte';

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

describe('SettingsDialog', () => {
	const listDevices = async () => [
		{ deviceId: 'mic-1', kind: 'audioinput' as const, label: 'Headset microphone' },
		{ deviceId: 'out-1', kind: 'audiooutput' as const, label: 'Headset' }
	];

	it('lists the sections next to the open one', async () => {
		render(SettingsDialog, { open: true, listDevices, audio: fakeAudio() });
		const nav = page.getByRole('navigation', { name: 'Settings sections' });
		await expect
			.element(nav.getByRole('button', { name: 'Audio & Mic' }))
			.toHaveAttribute('aria-current', 'page');
		await expect.element(page.getByRole('heading', { name: 'Audio & Mic' })).toBeVisible();
	});

	it('shows the chosen devices', async () => {
		render(SettingsDialog, {
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
		render(SettingsDialog, { open: true, listDevices, audio });
		await page.getByLabelText('Microphone', { exact: true }).click();
		await page.getByRole('option', { name: 'Headset microphone' }).click();
		expect(audio.updateSettings).toHaveBeenCalledWith({ inputDeviceId: 'mic-1' });
	});

	it('switches voice processing', async () => {
		const audio = fakeAudio();
		render(SettingsDialog, { open: true, listDevices, audio });
		const noise = page.getByRole('switch', { name: 'Noise suppression' });
		await expect.element(noise).toBeChecked();
		await noise.click();
		expect(audio.updateSettings).toHaveBeenCalledWith({ noiseSuppression: false });
	});

	it('switches a setting when its description is clicked', async () => {
		const audio = fakeAudio();
		render(SettingsDialog, { open: true, listDevices, audio });
		await page.getByText(/Keeps others from hearing themselves/).click();
		expect(audio.updateSettings).toHaveBeenCalledWith({ echoCancellation: false });
		await expect
			.element(page.getByRole('switch', { name: 'Echo cancellation' }))
			.toHaveAccessibleDescription(/Keeps others from hearing themselves/);
	});

	it('turns sound effects off', async () => {
		render(SettingsDialog, { open: true, listDevices, audio: fakeAudio() });
		const toggle = page.getByRole('switch', { name: 'Sound effects' });
		await expect.element(toggle).toBeChecked();
		await toggle.click();
		await expect.element(toggle).not.toBeChecked();
		expect(sounds.enabled).toBe(false);
		sounds.update({ enabled: true });
	});

	it('explains when the browser cannot pick speakers', async () => {
		render(SettingsDialog, {
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
