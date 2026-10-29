/**
 * How loud each person is in calls, set from the right-click menu on a user. Like the audio
 * settings it belongs to this browser and is kept in `localStorage`, so it applies to every
 * call and survives reloads. Nobody else is told.
 */
import { localStore, MAX_VOLUME } from '#lib/audio-settings.ts';

export type UserAudio = {
	/** From 0 to `MAX_VOLUME`, multiplied with the output volume of the audio settings. */
	volume: number;
	/** Muted only for this user, the others in the call still hear them. */
	muted: boolean;
};

export const DEFAULT_USER_AUDIO: UserAudio = { volume: 1, muted: false };

/** By user id. People at the defaults are left out. */
export type UserAudioMap = Record<string, UserAudio>;

const USER_AUDIO_KEY = 'lumio:user-audio';

export function parseUserAudio(value: unknown): UserAudioMap {
	const map: UserAudioMap = {};
	if (typeof value !== 'object' || value === null) return map;
	for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
		if (typeof entry !== 'object' || entry === null) continue;
		const e = entry as Record<string, unknown>;
		const volume =
			typeof e.volume === 'number' && Number.isFinite(e.volume)
				? Math.min(MAX_VOLUME, Math.max(0, e.volume))
				: 1;
		const audio = { volume, muted: e.muted === true };
		if (!isDefault(audio)) map[id] = audio;
	}
	return map;
}

function isDefault(audio: UserAudio): boolean {
	return audio.volume === 1 && !audio.muted;
}

/** Returns a new map with `patch` applied to one user, dropping them when back at the defaults. */
export function updateUserAudio(
	map: UserAudioMap,
	userId: string,
	patch: Partial<UserAudio>
): UserAudioMap {
	const audio = { ...(map[userId] ?? DEFAULT_USER_AUDIO), ...patch };
	audio.volume = Math.min(MAX_VOLUME, Math.max(0, audio.volume));
	const next = { ...map };
	if (isDefault(audio)) delete next[userId];
	else next[userId] = audio;
	return next;
}

/** What one person is played at: their own volume times the output volume, or 0 when muted. */
export function playbackVolume(
	outputVolume: number,
	audio: UserAudio = DEFAULT_USER_AUDIO,
	deafened = false
): number {
	return deafened || audio.muted ? 0 : outputVolume * audio.volume;
}

export function loadUserAudio(store = localStore()): UserAudioMap {
	try {
		const raw = store?.getItem(USER_AUDIO_KEY);
		return parseUserAudio(raw ? JSON.parse(raw) : null);
	} catch {
		return {};
	}
}

export function saveUserAudio(map: UserAudioMap, store = localStore()) {
	try {
		store?.setItem(USER_AUDIO_KEY, JSON.stringify(map));
	} catch {
		// Without storage the volumes only last until the page is reloaded.
	}
}
