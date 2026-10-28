/**
 * Plays the sound cues from `#lib/sounds.ts`, shared by the whole app. Settings are kept
 * per browser in `localStorage`, so a settings dialog can change them later.
 */
import { DEFAULT_SOUND_SETTINGS, parseSoundSettings, SOUNDS, type SoundName } from '#lib/sounds.ts';

const SETTINGS_KEY = 'lumio:sounds';

/** The parts of the Web Audio API the player uses. Lets tests pass a fake. */
export type AudioContextLike = Pick<
	AudioContext,
	'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'
>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage can be missing or throw (private windows, blocked site data), so every access is guarded. */
function localStore(): StorageLike | null {
	// Not on the server, where the player is created but never plays.
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage ?? null;
	} catch {
		return null;
	}
}

function browserAudio(): AudioContextLike | null {
	return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

export class SoundPlayer {
	enabled = $state(DEFAULT_SOUND_SETTINGS.enabled);
	volume = $state(DEFAULT_SOUND_SETTINGS.volume);

	#context: AudioContextLike | null = null;
	#createContext: () => AudioContextLike | null;
	#store: StorageLike | null;

	constructor(
		options: { createContext?: () => AudioContextLike | null; store?: StorageLike | null } = {}
	) {
		this.#createContext = options.createContext ?? browserAudio;
		this.#store = options.store === undefined ? localStore() : options.store;
		let raw: string | null = null;
		try {
			raw = this.#store?.getItem(SETTINGS_KEY) ?? null;
		} catch {
			// Use the defaults.
		}
		const settings = parseSoundSettings(raw);
		this.enabled = settings.enabled;
		this.volume = settings.volume;
	}

	/** Changes and stores the settings. */
	update(settings: { enabled?: boolean; volume?: number }): void {
		const next = parseSoundSettings(
			JSON.stringify({ enabled: this.enabled, volume: this.volume, ...settings })
		);
		this.enabled = next.enabled;
		this.volume = next.volume;
		try {
			this.#store?.setItem(SETTINGS_KEY, JSON.stringify(next));
		} catch {
			// The settings last until the page is reloaded.
		}
	}

	/** Plays a sound cue. Does nothing when sounds are off or the browser has no Web Audio. */
	play(name: SoundName): void {
		if (!this.enabled || this.volume <= 0) return;
		const context = this.#audio();
		if (!context) return;
		// Browsers start audio suspended until the user interacted with the page.
		if (context.state === 'suspended') void context.resume().catch(() => {});

		const recipe = SOUNDS[name];
		const peak = recipe.gain * this.volume;
		const now = context.currentTime;
		for (const note of recipe.notes) {
			const start = now + note.start;
			const end = start + note.duration;
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			oscillator.type = recipe.wave;
			oscillator.frequency.setValueAtTime(note.frequency, start);
			// Quick fade in and a smooth fade out, so the notes do not click.
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.0001, end);
			oscillator.connect(gain).connect(context.destination);
			oscillator.start(start);
			oscillator.stop(end + 0.02);
		}
	}

	#audio(): AudioContextLike | null {
		if (!this.#context) {
			try {
				this.#context = this.#createContext();
			} catch {
				return null;
			}
		}
		return this.#context;
	}
}

export const sounds = new SoundPlayer();
