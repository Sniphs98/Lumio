import { describe, expect, it } from 'vitest';
import {
	audioDevices,
	captureOptions,
	DEFAULT_AUDIO_SETTINGS,
	deviceLabel,
	loadAudioSettings,
	parseAudioSettings,
	saveAudioSettings
} from './audio-settings.ts';

function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value)
	};
}

const brokenStorage = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	}
};

describe('parseAudioSettings', () => {
	it('falls back to the defaults', () => {
		expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
		expect(parseAudioSettings('nope')).toEqual(DEFAULT_AUDIO_SETTINGS);
	});

	it('keeps valid fields and drops invalid ones', () => {
		expect(
			parseAudioSettings({
				inputDeviceId: 'mic-2',
				outputDeviceId: 42,
				noiseSuppression: false,
				echoCancellation: 'no',
				muted: true
			})
		).toEqual({
			...DEFAULT_AUDIO_SETTINGS,
			inputDeviceId: 'mic-2',
			noiseSuppression: false,
			muted: true
		});
	});

	it('clamps the volume', () => {
		expect(parseAudioSettings({ outputVolume: 1.5 }).outputVolume).toBe(1.5);
		expect(parseAudioSettings({ outputVolume: 3 }).outputVolume).toBe(2);
		expect(parseAudioSettings({ outputVolume: -1 }).outputVolume).toBe(0);
		expect(parseAudioSettings({ outputVolume: Number.NaN }).outputVolume).toBe(1);
	});

	it('mutes whoever is deafened', () => {
		expect(parseAudioSettings({ deafened: true, muted: false })).toMatchObject({
			deafened: true,
			muted: true
		});
	});
});

describe('loadAudioSettings and saveAudioSettings', () => {
	it('round-trips through storage', () => {
		const store = memoryStorage();
		const settings = { ...DEFAULT_AUDIO_SETTINGS, outputDeviceId: 'headset', outputVolume: 0.5 };
		saveAudioSettings(settings, store);
		expect(loadAudioSettings(store)).toEqual(settings);
	});

	it('survives missing, broken and blocked storage', () => {
		expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
		const store = memoryStorage();
		store.setItem('lumio:audio', '{not json');
		expect(loadAudioSettings(store)).toEqual(DEFAULT_AUDIO_SETTINGS);
		expect(loadAudioSettings(brokenStorage)).toEqual(DEFAULT_AUDIO_SETTINGS);
		expect(() => saveAudioSettings(DEFAULT_AUDIO_SETTINGS, brokenStorage)).not.toThrow();
	});
});

describe('captureOptions', () => {
	it('leaves the default microphone to the browser', () => {
		expect(captureOptions(DEFAULT_AUDIO_SETTINGS)).toEqual({
			deviceId: undefined,
			noiseSuppression: true,
			echoCancellation: true,
			autoGainControl: true
		});
		expect(
			captureOptions({ ...DEFAULT_AUDIO_SETTINGS, inputDeviceId: 'mic-2', noiseSuppression: false })
		).toMatchObject({ deviceId: 'mic-2', noiseSuppression: false });
	});
});

describe('audioDevices', () => {
	const devices = [
		{ deviceId: 'default', kind: 'audioinput', label: 'Default - Headset' },
		{ deviceId: 'mic-1', kind: 'audioinput', label: 'Headset' },
		{ deviceId: 'mic-2', kind: 'audioinput', label: '' },
		{ deviceId: 'mic-1', kind: 'audioinput', label: 'Headset' },
		{ deviceId: 'out-1', kind: 'audiooutput', label: 'Speakers (USB)' },
		{ deviceId: 'cam-1', kind: 'videoinput', label: 'Camera' }
	] as const satisfies Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[];

	it('lists one kind with the default first and names unnamed devices', () => {
		expect(audioDevices([...devices], 'audioinput')).toEqual([
			{ id: 'default', label: 'Default' },
			{ id: 'mic-1', label: 'Headset' },
			{ id: 'mic-2', label: 'Microphone 2' }
		]);
		expect(audioDevices([...devices], 'audiooutput')).toEqual([
			{ id: 'default', label: 'Default' },
			{ id: 'out-1', label: 'Speakers (USB)' }
		]);
	});

	it('labels unplugged devices as the default', () => {
		const list = audioDevices([...devices], 'audioinput');
		expect(deviceLabel(list, 'mic-1')).toBe('Headset');
		expect(deviceLabel(list, 'gone')).toBe('Default');
	});
});
