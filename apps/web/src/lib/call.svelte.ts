/**
 * The current voice or video call, shared by the whole app. It lives outside of any page,
 * so the call keeps running and the call bar stays visible while the user switches tabs.
 */
import {
	Room,
	RoomEvent,
	Track,
	type Participant,
	type RemoteParticipant,
	type RemoteTrack
} from 'livekit-client';
import {
	RING_TIMEOUT_MS,
	roomName,
	SCREEN_SHARE_QUALITY,
	type CallKind,
	type CallRingingEvent,
	type CallSource,
	type ScreenShareQuality
} from '#lib/calls.ts';
import {
	canBoostVolume,
	captureOptions,
	DEFAULT_AUDIO_SETTINGS,
	loadAudioSettings,
	saveAudioSettings,
	type AudioSettings
} from '#lib/audio-settings.ts';
import { sounds } from '#lib/sound-player.svelte.ts';
import {
	DEFAULT_USER_AUDIO,
	loadUserAudio,
	playbackVolume,
	saveUserAudio,
	updateUserAudio,
	type UserAudio,
	type UserAudioMap
} from '#lib/user-audio.ts';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

export type CallTarget = {
	kind: CallKind;
	id: string;
	/** Shown in the call bar, e.g. `Lounge` or a friend's name. */
	name: string;
};

/** Anything that can be shown in a `<video>` element, e.g. a LiveKit video track. */
export type AttachableTrack = {
	attach(element: HTMLMediaElement): HTMLMediaElement;
	detach(element: HTMLMediaElement): HTMLMediaElement;
};

export type CallParticipant = {
	identity: string;
	name: string;
	isLocal: boolean;
	speaking: boolean;
	micMuted: boolean;
	camera: AttachableTrack | null;
	screen: AttachableTrack | null;
};

/**
 * Mute, deafen and the audio settings, also usable outside of a call: the choice carries
 * over to the next call. Lets component tests pass a fake.
 */
export interface AudioControls {
	readonly muted: boolean;
	readonly deafened: boolean;
	readonly settings: AudioSettings;
	/** Whether this browser can choose the speakers, see `HTMLMediaElement.setSinkId`. */
	readonly outputSelectionSupported: boolean;
	/** Whether volumes can go above 100 %, see `canBoostVolume`. */
	readonly volumeBoostSupported: boolean;
	toggleMute(): Promise<void>;
	toggleDeafen(): void;
	updateSettings(patch: Partial<AudioSettings>): Promise<void>;
}

/** Volume and mute per person, from the right-click menu. Lets component tests pass a fake. */
export interface UserAudioControls {
	/** Whether volumes can go above 100 %, see `canBoostVolume`. */
	readonly volumeBoostSupported: boolean;
	userAudioOf(userId: string): UserAudio;
	setUserAudio(userId: string, patch: Partial<UserAudio>): void;
}

/** What the call bar and call pages need from a call. Lets component tests pass a fake. */
export interface CallControls {
	readonly status: CallStatus;
	readonly target: CallTarget | null;
	readonly participants: CallParticipant[];
	readonly muted: boolean;
	readonly deafened: boolean;
	readonly cameraOn: boolean;
	readonly screenSharing: boolean;
	readonly screenShareSupported: boolean;
	readonly audioBlocked: boolean;
	readonly error: string | null;
	canPublish(source: CallSource): boolean;
	isIn(kind: CallKind, id: string): boolean;
	join(target: CallTarget): Promise<void>;
	leave(): Promise<void>;
	toggleMute(): Promise<void>;
	toggleDeafen(): void;
	toggleCamera(): Promise<void>;
	toggleScreenShare(quality?: ScreenShareQuality): Promise<void>;
	startAudio(): Promise<void>;
	dismissError(): void;
}

export class Call implements CallControls, AudioControls, UserAudioControls {
	status = $state<CallStatus>('idle');
	target = $state.raw<CallTarget | null>(null);
	participants = $state.raw<CallParticipant[]>([]);
	settings = $state.raw<AudioSettings>({ ...DEFAULT_AUDIO_SETTINGS });
	/** Volume and mute per person, see `#lib/user-audio.ts`. */
	userAudio = $state.raw<UserAudioMap>({});
	cameraOn = $state(false);
	screenSharing = $state(false);
	audioBlocked = $state(false);
	error = $state<string | null>(null);
	/** Someone started a conversation call the user is not in yet. */
	ringing = $state.raw<CallRingingEvent | null>(null);

	#room: Room | null = null;
	#sources: CallSource[] = [];
	#audio: HTMLElement | null = null;
	/** Mute state from before deafening, restored when undeafening. */
	#mutedBeforeDeafen = false;
	#ringTimer: ReturnType<typeof setTimeout> | undefined;
	/** The settings as stored. A call can mute without storing it, e.g. without a microphone. */
	#saved: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

	get muted(): boolean {
		return this.settings.muted;
	}

	get deafened(): boolean {
		return this.settings.deafened;
	}

	get outputSelectionSupported(): boolean {
		return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
	}

	get volumeBoostSupported(): boolean {
		return canBoostVolume();
	}

	/** Loads the stored settings. Called in the browser after hydration. */
	restoreSettings(): void {
		this.#saved = loadAudioSettings();
		this.settings = { ...this.#saved };
		this.userAudio = loadUserAudio();
	}

	userAudioOf(userId: string): UserAudio {
		return this.userAudio[userId] ?? DEFAULT_USER_AUDIO;
	}

	/** Changes how loud someone is for this user only, in this and every later call. */
	setUserAudio(userId: string, patch: Partial<UserAudio>): void {
		this.userAudio = updateUserAudio(this.userAudio, userId, patch);
		saveUserAudio(this.userAudio);
		const participant = this.#room?.remoteParticipants.get(userId);
		if (participant) this.#applyVolume(participant);
	}

	async updateSettings(patch: Partial<AudioSettings>): Promise<void> {
		const before = this.settings;
		this.#set(patch);
		const room = this.#room;
		if (!room) return;
		const after = this.settings;
		if (after.outputVolume !== before.outputVolume) {
			for (const p of room.remoteParticipants.values()) this.#applyVolume(p);
		}
		try {
			if (after.outputDeviceId !== before.outputDeviceId) {
				await room.switchActiveDevice('audiooutput', after.outputDeviceId);
			}
			if (
				after.inputDeviceId !== before.inputDeviceId ||
				after.noiseSuppression !== before.noiseSuppression ||
				after.echoCancellation !== before.echoCancellation ||
				after.autoGainControl !== before.autoGainControl
			) {
				// A new microphone track with the new device and processing. Without a track yet,
				// unmuting picks up the settings.
				const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone);
				await mic?.audioTrack?.restartTrack(captureOptions(after));
			}
		} catch {
			this.error = 'Could not switch the audio device.';
		}
	}

	get screenShareSupported(): boolean {
		// Most mobile browsers cannot capture the screen.
		return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
	}

	canPublish(source: CallSource): boolean {
		return this.#sources.includes(source);
	}

	isIn(kind: CallKind, id: string): boolean {
		return this.status !== 'idle' && this.target?.kind === kind && this.target.id === id;
	}

	async join(target: CallTarget): Promise<void> {
		if (this.isIn(target.kind, target.id)) return;
		if (this.status !== 'idle') await this.leave();
		if (this.ringing?.conversationId === target.id) this.dismissRinging();

		this.status = 'connecting';
		this.target = target;
		this.error = null;

		const room = new Room({
			adaptiveStream: true,
			dynacast: true,
			audioCaptureDefaults: captureOptions(this.settings),
			audioOutput: { deviceId: this.settings.outputDeviceId },
			// Plays everyone through a gain node, so volumes can go above 100 %.
			webAudioMix: this.volumeBoostSupported
		});
		this.#room = room;
		this.#listen(room);

		try {
			const res = await fetch('/api/livekit/token', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ room: roomName(target.kind, target.id) })
			});
			if (!res.ok) {
				throw new JoinError(
					res.status === 404 ? 'You cannot join this call.' : 'Could not join the call.'
				);
			}
			const { url, token, sources } = (await res.json()) as {
				url: string;
				token: string;
				sources: CallSource[];
			};
			this.#sources = sources;
			await room.connect(url, token);
		} catch (e) {
			if (this.#room !== room) return;
			this.#reset();
			void room.disconnect();
			this.error = e instanceof JoinError ? e.message : 'Could not connect to the call server.';
			return;
		}
		if (this.#room !== room) return;

		this.status = 'connected';
		sounds.play('call.join');
		this.audioBlocked = !room.canPlaybackAudio;
		if (this.canPublish('microphone')) {
			try {
				if (!this.muted) await this.#enableMicrophone(room, true);
			} catch {
				this.#set({ muted: true }, false);
				this.error = 'No microphone access. Others cannot hear you.';
			}
		} else {
			this.#set({ muted: true }, false);
		}
		this.#sync();
	}

	async leave(): Promise<void> {
		const room = this.#room;
		if (room && this.status !== 'connecting') sounds.play('call.leave');
		this.#reset();
		await room?.disconnect();
	}

	async toggleMute(): Promise<void> {
		const room = this.#room;
		const muted = !this.muted;
		// Outside of a call this only sets how the next call starts.
		if (room) {
			if (!this.canPublish('microphone')) return;
			try {
				await this.#enableMicrophone(room, !muted);
				this.error = null;
			} catch {
				this.error = 'No microphone access. Others cannot hear you.';
				this.#sync();
				return;
			}
		}
		// Unmuting while deafened undeafens too, like in Discord.
		this.#set(!muted && this.deafened ? { muted, deafened: false } : { muted });
		sounds.play(muted ? 'mute' : 'unmute');
		this.#applyVolumes();
		this.#sync();
	}

	toggleDeafen(): void {
		const room = this.#room;
		sounds.play(this.deafened ? 'unmute' : 'mute');
		if (!this.deafened) {
			this.#mutedBeforeDeafen = this.muted;
			if (room && !this.muted) void this.#enableMicrophone(room, false).catch(() => {});
			this.#set({ deafened: true, muted: true });
		} else {
			const unmute = !this.#mutedBeforeDeafen && (!room || this.canPublish('microphone'));
			this.#set({ deafened: false, muted: !unmute && this.muted });
			if (room && unmute) {
				void this.#enableMicrophone(room, true).catch(() => {
					this.#set({ muted: true }, false);
				});
			}
		}
		this.#applyVolumes();
		this.#sync();
	}

	async toggleCamera(): Promise<void> {
		const room = this.#room;
		if (!room || !this.canPublish('camera')) return;
		try {
			await room.localParticipant.setCameraEnabled(!this.cameraOn, {
				resolution: { width: 1280, height: 720, frameRate: 30 }
			});
			this.error = null;
		} catch {
			this.error = 'No camera access.';
		}
		this.#sync();
	}

	async toggleScreenShare(quality: ScreenShareQuality = '1080p30'): Promise<void> {
		const room = this.#room;
		if (!room || !this.canPublish('screen_share') || !this.screenShareSupported) return;
		const q = SCREEN_SHARE_QUALITY[quality];
		try {
			await room.localParticipant.setScreenShareEnabled(
				!this.screenSharing,
				{
					audio: true,
					contentHint: q.frameRate > 30 ? 'motion' : 'detail',
					resolution: { width: q.width, height: q.height, frameRate: q.frameRate },
					selfBrowserSurface: 'exclude',
					surfaceSwitching: 'include'
				},
				{ screenShareEncoding: { maxBitrate: q.maxBitrate, maxFramerate: q.frameRate } }
			);
			this.error = null;
		} catch (e) {
			// Closing the browser's picker is not an error.
			if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
				this.error = 'Could not share your screen.';
			}
		}
		this.#sync();
	}

	async startAudio(): Promise<void> {
		await this.#room?.startAudio();
		this.audioBlocked = this.#room ? !this.#room.canPlaybackAudio : false;
	}

	dismissError(): void {
		this.error = null;
	}

	/** Shows an incoming call, unless the user is already in it. */
	ring(event: CallRingingEvent): void {
		if (this.isIn('conversation', event.conversationId)) return;
		clearTimeout(this.#ringTimer);
		this.ringing = event;
		this.#ringTimer = setTimeout(() => this.dismissRinging(), RING_TIMEOUT_MS);
	}

	dismissRinging(): void {
		clearTimeout(this.#ringTimer);
		this.ringing = null;
	}

	#listen(room: Room) {
		const sync = () => {
			if (this.#room === room) this.#sync();
		};
		room
			.on(RoomEvent.ParticipantConnected, () => {
				if (this.#room !== room) return;
				sounds.play('participant.join');
				this.#sync();
			})
			.on(RoomEvent.ParticipantDisconnected, () => {
				if (this.#room !== room) return;
				sounds.play('participant.leave');
				this.#sync();
			})
			.on(RoomEvent.ParticipantNameChanged, sync)
			.on(RoomEvent.ActiveSpeakersChanged, sync)
			.on(RoomEvent.TrackMuted, sync)
			.on(RoomEvent.TrackUnmuted, sync)
			.on(RoomEvent.LocalTrackPublished, sync)
			.on(RoomEvent.LocalTrackUnpublished, sync)
			.on(RoomEvent.TrackUnpublished, sync)
			.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
				if (this.#room !== room) return;
				if (track.kind === Track.Kind.Audio) this.#playAudio(track, participant);
				this.#sync();
			})
			.on(RoomEvent.TrackUnsubscribed, (track) => {
				// Video elements belong to the call stage, which detaches them itself.
				if (track.kind === Track.Kind.Audio) track.detach().forEach((el) => el.remove());
				sync();
			})
			.on(RoomEvent.AudioPlaybackStatusChanged, () => {
				if (this.#room === room) this.audioBlocked = !room.canPlaybackAudio;
			})
			.on(RoomEvent.Reconnecting, () => {
				if (this.#room === room) this.status = 'reconnecting';
			})
			.on(RoomEvent.Reconnected, () => {
				if (this.#room === room) this.status = 'connected';
			})
			.on(RoomEvent.Disconnected, () => {
				// Dropped by the server or the network. Hanging up clears #room first.
				if (this.#room !== room) return;
				sounds.play('call.leave');
				this.#reset();
				this.error = 'The call was disconnected.';
			});
	}

	#playAudio(track: RemoteTrack, participant: RemoteParticipant) {
		if (!this.#audio) {
			this.#audio = document.createElement('div');
			this.#audio.hidden = true;
			this.#audio.dataset.callAudio = '';
			document.body.append(this.#audio);
		}
		this.#audio.append(track.attach());
		this.#applyVolume(participant);
	}

	#applyVolume(participant: RemoteParticipant) {
		let volume = playbackVolume(
			this.settings.outputVolume,
			this.userAudio[participant.identity],
			this.deafened
		);
		// Media elements throw above 100 %; settings from another browser may still be louder.
		if (!this.volumeBoostSupported) volume = Math.min(1, volume);
		participant.setVolume(volume, Track.Source.Microphone);
		participant.setVolume(volume, Track.Source.ScreenShareAudio);
	}

	#applyVolumes() {
		for (const p of this.#room?.remoteParticipants.values() ?? []) this.#applyVolume(p);
	}

	#enableMicrophone(room: Room, enabled: boolean) {
		return room.localParticipant.setMicrophoneEnabled(
			enabled,
			enabled ? captureOptions(this.settings) : undefined
		);
	}

	/** Changes the settings and stores them, unless `persist` is false. */
	#set(patch: Partial<AudioSettings>, persist = true) {
		this.settings = { ...this.settings, ...patch };
		if (!persist) return;
		this.#saved = { ...this.#saved, ...patch };
		saveAudioSettings(this.#saved);
	}

	#sync() {
		const room = this.#room;
		if (!room) return;
		const local = room.localParticipant;
		this.cameraOn = local.isCameraEnabled;
		this.screenSharing = local.isScreenShareEnabled;
		const all: Participant[] = [local, ...room.remoteParticipants.values()];
		this.participants = all.map((p) => ({
			identity: p.identity,
			name: p.name || p.identity,
			isLocal: p === local,
			speaking: p.isSpeaking,
			micMuted: !p.isMicrophoneEnabled,
			camera: videoOf(p, Track.Source.Camera),
			screen: videoOf(p, Track.Source.ScreenShare)
		}));
	}

	#reset() {
		this.#room = null;
		this.#sources = [];
		this.#audio?.remove();
		this.#audio = null;
		this.status = 'idle';
		this.target = null;
		this.participants = [];
		// Back to what the user chose, e.g. after the call muted them for lack of a microphone.
		this.settings = { ...this.settings, muted: this.#saved.muted, deafened: this.#saved.deafened };
		this.cameraOn = false;
		this.screenSharing = false;
		this.audioBlocked = false;
		this.error = null;
	}
}

function videoOf(p: Participant, source: Track.Source): AttachableTrack | null {
	const pub = p.getTrackPublication(source);
	if (!pub || pub.isMuted) return null;
	return pub.videoTrack ?? null;
}

class JoinError extends Error {}

export const call = new Call();
