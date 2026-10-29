import { describe, expect, it } from 'vitest';
import {
	loadUserAudio,
	parseUserAudio,
	playbackVolume,
	saveUserAudio,
	updateUserAudio
} from './user-audio.ts';

function memoryStore() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value)
	};
}

describe('user audio', () => {
	it('keeps valid entries and clamps the volume', () => {
		expect(
			parseUserAudio({
				anna: { volume: 0.5, muted: false },
				ben: { volume: 3, muted: true },
				cleo: 'loud',
				dave: { volume: 1, muted: false }
			})
		).toEqual({ anna: { volume: 0.5, muted: false }, ben: { volume: 2, muted: true } });
		expect(parseUserAudio(null)).toEqual({});
	});

	it('drops people who are back at the defaults', () => {
		const quiet = updateUserAudio({}, 'anna', { volume: 0.3 });
		expect(quiet).toEqual({ anna: { volume: 0.3, muted: false } });
		expect(updateUserAudio(quiet, 'anna', { volume: 1 })).toEqual({});
	});

	it('plays people at their volume times the output volume', () => {
		expect(playbackVolume(0.5, { volume: 0.5, muted: false })).toBe(0.25);
		expect(playbackVolume(0.8)).toBe(0.8);
		expect(playbackVolume(2, { volume: 1.5, muted: false })).toBe(3);
		expect(playbackVolume(1, { volume: 1, muted: true })).toBe(0);
		expect(playbackVolume(1, undefined, true)).toBe(0);
	});

	it('survives a reload', () => {
		const store = memoryStore();
		saveUserAudio({ anna: { volume: 0.4, muted: true } }, store);
		expect(loadUserAudio(store)).toEqual({ anna: { volume: 0.4, muted: true } });
	});
});
