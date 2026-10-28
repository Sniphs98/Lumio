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

export class Call implements CallControls {
	status = $state<CallStatus>('idle');
	target = $state.raw<CallTarget | null>(null);
	participants = $state.raw<CallParticipant[]>([]);
	muted = $state(false);
	deafened = $state(false);
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
			audioCaptureDefaults: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true
			}
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
		this.audioBlocked = !room.canPlaybackAudio;
		if (this.canPublish('microphone')) {
			try {
				await room.localParticipant.setMicrophoneEnabled(!this.muted);
			} catch {
				this.muted = true;
				this.error = 'No microphone access. Others cannot hear you.';
			}
		} else {
			this.muted = true;
		}
		this.#sync();
	}

	async leave(): Promise<void> {
		const room = this.#room;
		this.#reset();
		await room?.disconnect();
	}

	async toggleMute(): Promise<void> {
		const room = this.#room;
		if (!room || !this.canPublish('microphone')) return;
		const muted = !this.muted;
		try {
			await room.localParticipant.setMicrophoneEnabled(!muted);
			this.muted = muted;
			this.error = null;
			// Unmuting while deafened undeafens too, like in Discord.
			if (!muted && this.deafened) this.#setDeafened(false);
		} catch {
			this.error = 'No microphone access. Others cannot hear you.';
		}
		this.#sync();
	}

	toggleDeafen(): void {
		if (!this.#room) return;
		const deafened = !this.deafened;
		this.#setDeafened(deafened);
		if (deafened) {
			this.#mutedBeforeDeafen = this.muted;
			if (!this.muted) void this.#room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
			this.muted = true;
		} else if (!this.#mutedBeforeDeafen && this.canPublish('microphone')) {
			this.muted = false;
			void this.#room.localParticipant.setMicrophoneEnabled(true).catch(() => {
				this.muted = true;
			});
		}
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
			.on(RoomEvent.ParticipantConnected, sync)
			.on(RoomEvent.ParticipantDisconnected, sync)
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
		if (this.deafened) this.#applyVolume(participant);
	}

	#applyVolume(participant: RemoteParticipant) {
		const volume = this.deafened ? 0 : 1;
		participant.setVolume(volume, Track.Source.Microphone);
		participant.setVolume(volume, Track.Source.ScreenShareAudio);
	}

	#setDeafened(deafened: boolean) {
		this.deafened = deafened;
		for (const p of this.#room?.remoteParticipants.values() ?? []) this.#applyVolume(p);
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
		this.muted = false;
		this.deafened = false;
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
