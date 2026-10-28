/**
 * Short sound cues for calls and messages, e.g. when someone joins a call. The sounds are
 * synthesized with the Web Audio API from the notes below, so there are no audio files to
 * license or download. The player lives in `#lib/sound-player.svelte.ts`.
 */
import type { ActivityEvent } from '#lib/chat.ts';

export type SoundName =
	| 'call.join'
	| 'call.leave'
	| 'participant.join'
	| 'participant.leave'
	| 'mute'
	| 'unmute'
	| 'message';

export type SoundNote = {
	/** Pitch in Hz. */
	frequency: number;
	/** Seconds after the sound starts. */
	start: number;
	/** Seconds, including the fade out. */
	duration: number;
};

export type SoundRecipe = {
	wave: OscillatorType;
	/** Loudness at full volume, from 0 to 1. Kept low, the cues should not startle anyone. */
	gain: number;
	notes: SoundNote[];
};

// Note pitches in Hz.
const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;

function notes(frequencies: number[], step: number, duration: number): SoundNote[] {
	return frequencies.map((frequency, i) => ({ frequency, start: i * step, duration }));
}

/** Rising notes for joining, falling ones for leaving, so the two are easy to tell apart. */
export const SOUNDS: Record<SoundName, SoundRecipe> = {
	'call.join': { wave: 'sine', gain: 0.25, notes: notes([C5, E5, G5], 0.08, 0.18) },
	'call.leave': { wave: 'sine', gain: 0.25, notes: notes([G5, E5, C5], 0.08, 0.18) },
	'participant.join': { wave: 'sine', gain: 0.2, notes: notes([E5, A5], 0.09, 0.16) },
	'participant.leave': { wave: 'sine', gain: 0.2, notes: notes([A5, E5], 0.09, 0.16) },
	mute: { wave: 'triangle', gain: 0.3, notes: notes([C5, G4], 0.06, 0.1) },
	unmute: { wave: 'triangle', gain: 0.3, notes: notes([G4, C5], 0.06, 0.1) },
	message: { wave: 'sine', gain: 0.2, notes: notes([C6, E6], 0.07, 0.22) }
};

/** How long a sound plays, in seconds. */
export function soundLength(recipe: SoundRecipe): number {
	return Math.max(...recipe.notes.map((n) => n.start + n.duration));
}

export type SoundSettings = {
	enabled: boolean;
	/** From 0 to 1. */
	volume: number;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { enabled: true, volume: 0.7 };

/** Reads stored settings, falling back to the defaults for anything missing or broken. */
export function parseSoundSettings(raw: string | null | undefined): SoundSettings {
	let value: Partial<SoundSettings> = {};
	try {
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (parsed && typeof parsed === 'object') value = parsed as Partial<SoundSettings>;
	} catch {
		// Broken settings: use the defaults.
	}
	return {
		enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SOUND_SETTINGS.enabled,
		volume:
			typeof value.volume === 'number' && Number.isFinite(value.volume)
				? Math.min(1, Math.max(0, value.volume))
				: DEFAULT_SOUND_SETTINGS.volume
	};
}

/**
 * Whether a new message should play the message sound: always in direct and group
 * conversations, in server channels only when the message mentions the user. Messages in
 * the chat the user is looking at and the user's own messages stay silent.
 */
export function shouldPlayMessageSound(
	event: ActivityEvent,
	userId: string,
	openChat: { id: string | undefined; visible: boolean }
): boolean {
	if (event.authorId === userId) return false;
	const chatId = event.channelId ?? event.conversationId;
	if (openChat.visible && chatId === openChat.id) return false;
	return event.conversationId !== null || event.mentionIds.includes(userId);
}
