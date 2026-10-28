import { afterEach, describe, expect, it } from 'vitest';
import { loadAudioSettings } from './audio-settings.ts';
import { Call } from './call.svelte.ts';

afterEach(() => localStorage.clear());

describe('Call outside of a call', () => {
	it('mutes and keeps the choice for the next call and reload', async () => {
		const call = new Call();
		await call.toggleMute();
		expect(call.muted).toBe(true);
		expect(loadAudioSettings().muted).toBe(true);

		const reloaded = new Call();
		reloaded.restoreSettings();
		expect(reloaded.muted).toBe(true);
	});

	it('deafening mutes, undeafening restores the microphone', () => {
		const call = new Call();
		call.toggleDeafen();
		expect(call.deafened).toBe(true);
		expect(call.muted).toBe(true);
		call.toggleDeafen();
		expect(call.deafened).toBe(false);
		expect(call.muted).toBe(false);
	});

	it('stays muted after undeafening when muted before', async () => {
		const call = new Call();
		await call.toggleMute();
		call.toggleDeafen();
		call.toggleDeafen();
		expect(call.muted).toBe(true);
	});

	it('unmuting while deafened undeafens', async () => {
		const call = new Call();
		call.toggleDeafen();
		await call.toggleMute();
		expect(call.muted).toBe(false);
		expect(call.deafened).toBe(false);
	});

	it('stores changed settings', async () => {
		const call = new Call();
		await call.updateSettings({ noiseSuppression: false, outputVolume: 0.4 });
		expect(call.settings.noiseSuppression).toBe(false);
		expect(loadAudioSettings()).toMatchObject({ noiseSuppression: false, outputVolume: 0.4 });
	});
});
