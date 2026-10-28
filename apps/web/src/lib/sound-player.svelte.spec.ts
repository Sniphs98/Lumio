import { describe, expect, it } from 'vitest';
import { SoundPlayer, type AudioContextLike } from '#lib/sound-player.svelte.ts';
import { SOUNDS } from '#lib/sounds.ts';

/** Records the notes a player starts instead of playing them. */
function fakeAudio(state: AudioContextState = 'running') {
	type FakeGain = { peak: number };
	type FakeNote = { type: OscillatorType; frequency: number; gain: FakeGain | null };
	const started: FakeNote[] = [];
	let resumed = 0;
	const context = {
		currentTime: 0,
		destination: {},
		state,
		resume: async () => {
			resumed++;
		},
		createOscillator() {
			const note: FakeNote = { type: 'sine', frequency: 0, gain: null };
			return {
				set type(type: OscillatorType) {
					note.type = type;
				},
				frequency: { setValueAtTime: (value: number) => (note.frequency = value) },
				connect: (gain: FakeGain) => {
					note.gain = gain;
					return gain;
				},
				start: () => started.push(note),
				stop: () => {}
			};
		},
		createGain() {
			const node = {
				peak: 0,
				gain: {
					setValueAtTime: () => {},
					exponentialRampToValueAtTime: (value: number) => {
						node.peak = Math.max(node.peak, value);
					}
				},
				connect: () => {}
			};
			return node;
		}
	} as unknown as AudioContextLike;
	return { context, started, resumes: () => resumed };
}

function memoryStore(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value)
	};
}

describe('SoundPlayer', () => {
	it('plays the notes of a sound at the chosen volume', () => {
		const audio = fakeAudio();
		const player = new SoundPlayer({ createContext: () => audio.context, store: memoryStore() });
		player.update({ volume: 0.5 });
		player.play('participant.join');

		const recipe = SOUNDS['participant.join'];
		expect(audio.started.map((n) => n.frequency)).toEqual(recipe.notes.map((n) => n.frequency));
		expect(audio.started.every((n) => n.type === recipe.wave)).toBe(true);
		expect(audio.started[0].gain?.peak).toBeCloseTo(recipe.gain * 0.5);
	});

	it('stays silent when sounds are off', () => {
		const audio = fakeAudio();
		const player = new SoundPlayer({ createContext: () => audio.context, store: memoryStore() });
		player.update({ enabled: false });
		player.play('message');
		expect(audio.started).toEqual([]);
	});

	it('resumes audio the browser suspended', () => {
		const audio = fakeAudio('suspended');
		const player = new SoundPlayer({ createContext: () => audio.context, store: memoryStore() });
		player.play('mute');
		expect(audio.resumes()).toBe(1);
	});

	it("plays every sound with the browser's Web Audio", () => {
		const player = new SoundPlayer({ store: memoryStore() });
		for (const name of Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]) {
			expect(() => player.play(name)).not.toThrow();
		}
	});

	it('keeps working without Web Audio', () => {
		const player = new SoundPlayer({ createContext: () => null, store: memoryStore() });
		expect(() => player.play('call.join')).not.toThrow();
	});

	it('remembers its settings', () => {
		const store = memoryStore();
		new SoundPlayer({ store }).update({ enabled: false, volume: 0.2 });
		const player = new SoundPlayer({ store });
		expect(player.enabled).toBe(false);
		expect(player.volume).toBe(0.2);
	});
});
