/**
 * The user's audio settings: which microphone and speakers to use, voice processing and
 * whether they are muted or deafened. They belong to this browser, like in Discord, and
 * are kept in `localStorage` so they survive reloads and apply to every call.
 */

export type AudioSettings = {
	/** `deviceId` of the microphone, or `default` for the browser's choice. */
	inputDeviceId: string;
	/** `deviceId` of the speakers or headphones, or `default` for the browser's choice. */
	outputDeviceId: string;
	/** Volume of everyone else in a call, from 0 to `MAX_VOLUME`. */
	outputVolume: number;
	noiseSuppression: boolean;
	echoCancellation: boolean;
	autoGainControl: boolean;
	/** Muted and deafened carry over to the next call, also when set outside of a call. */
	muted: boolean;
	deafened: boolean;
};

export const DEFAULT_DEVICE = 'default';

/** Volumes go up to 200 %, to turn up people who are too quiet. */
export const MAX_VOLUME = 2;

/**
 * Whether volumes above 100 % work in this browser. Media elements stop at 100 %, so louder
 * playback goes through LiveKit's Web Audio mix (`webAudioMix`), where a gain node sets the
 * volume. The speakers are then chosen with `AudioContext.setSinkId`. Browsers that can only
 * choose speakers on media elements (Firefox) keep element playback and stop at 100 %, so
 * choosing the speakers keeps working there.
 */
export function canBoostVolume(): boolean {
	if (typeof AudioContext === 'undefined') return false;
	const contextSink = 'setSinkId' in AudioContext.prototype;
	const elementSink =
		typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
	return contextSink || !elementSink;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
	inputDeviceId: DEFAULT_DEVICE,
	outputDeviceId: DEFAULT_DEVICE,
	outputVolume: 1,
	noiseSuppression: true,
	echoCancellation: true,
	autoGainControl: true,
	muted: false,
	deafened: false
};

const AUDIO_SETTINGS_KEY = 'lumio:audio';

/** Keeps valid fields of stored settings and falls back to the defaults for the rest. */
export function parseAudioSettings(value: unknown): AudioSettings {
	const settings = { ...DEFAULT_AUDIO_SETTINGS };
	if (typeof value !== 'object' || value === null) return settings;
	const v = value as Record<string, unknown>;
	for (const key of ['inputDeviceId', 'outputDeviceId'] as const) {
		if (typeof v[key] === 'string' && v[key]) settings[key] = v[key];
	}
	for (const key of [
		'noiseSuppression',
		'echoCancellation',
		'autoGainControl',
		'muted',
		'deafened'
	] as const) {
		if (typeof v[key] === 'boolean') settings[key] = v[key];
	}
	if (typeof v.outputVolume === 'number' && Number.isFinite(v.outputVolume)) {
		settings.outputVolume = Math.min(MAX_VOLUME, Math.max(0, v.outputVolume));
	}
	// Deafened always means muted, see `Call.toggleDeafen`.
	if (settings.deafened) settings.muted = true;
	return settings;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage can be missing or throw (private windows, blocked site data), so every access is guarded. */
export function localStore(): StorageLike | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function loadAudioSettings(store = localStore()): AudioSettings {
	try {
		const raw = store?.getItem(AUDIO_SETTINGS_KEY);
		return parseAudioSettings(raw ? JSON.parse(raw) : null);
	} catch {
		return { ...DEFAULT_AUDIO_SETTINGS };
	}
}

export function saveAudioSettings(settings: AudioSettings, store = localStore()) {
	try {
		store?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		// Without storage the settings only last until the page is reloaded.
	}
}

/** Microphone constraints for LiveKit's `audioCaptureDefaults` and `restartTrack`. */
export function captureOptions(settings: AudioSettings) {
	return {
		deviceId: settings.inputDeviceId === DEFAULT_DEVICE ? undefined : settings.inputDeviceId,
		noiseSuppression: settings.noiseSuppression,
		echoCancellation: settings.echoCancellation,
		autoGainControl: settings.autoGainControl
	};
}

export type AudioDevice = { id: string; label: string };

/**
 * Lists microphones or speakers for a picker. Browsers hide device names until the site may
 * use the microphone, so unnamed devices are numbered. The browser's default comes first.
 */
export function audioDevices(
	devices: Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[],
	kind: 'audioinput' | 'audiooutput'
): AudioDevice[] {
	const list: AudioDevice[] = [{ id: DEFAULT_DEVICE, label: 'Default' }];
	const fallback = kind === 'audioinput' ? 'Microphone' : 'Speakers';
	for (const d of devices) {
		// Chrome lists the default device twice: as `default` and under its own id.
		if (d.kind !== kind || !d.deviceId || d.deviceId === DEFAULT_DEVICE) continue;
		if (list.some((x) => x.id === d.deviceId)) continue;
		list.push({ id: d.deviceId, label: d.label || `${fallback} ${list.length}` });
	}
	return list;
}

/** The label of the chosen device; a device that was unplugged falls back to the default. */
export function deviceLabel(devices: AudioDevice[], id: string): string {
	return (devices.find((d) => d.id === id) ?? devices[0])?.label ?? 'Default';
}
